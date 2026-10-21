import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// GET /api/place-thumbnail?name=오사카성&lat=34.68&lng=135.52
// 장소의 구글 첫 번째 사진으로 리다이렉트 (없으면 404)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!API_KEY || !name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    let findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(name)}&inputtype=textquery&fields=photos&key=${API_KEY}`;
    if (lat && lng) findUrl += `&locationbias=point:${lat},${lng}`;

    const res = await fetch(findUrl);
    const data = await res.json();
    const photoRef = data.candidates?.[0]?.photos?.[0]?.photo_reference;

    if (!photoRef) {
      // 사진이 없는 장소도 매번 재조회하지 않도록 하루 동안은 캐시
      return NextResponse.json({ error: "no photo found" }, { status: 404, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
    }

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=300&photo_reference=${photoRef}&key=${API_KEY}`;
    // 이름/좌표가 같으면 결과가 거의 바뀌지 않으므로, 모든 참여자가 같은 URL을 볼 때 Vercel CDN(s-maxage)에서 공유 캐시되어
    // 재방문/다른 참여자가 열 때마다 구글 API를 다시 호출하지 않도록 함 (게이트/터미널 조회가 한도를 소진했던 것과 같은 문제 방지)
    return NextResponse.redirect(photoUrl, { headers: { "Cache-Control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400" } });
  } catch (e) {
    console.warn("place-thumbnail failed", e);
    return NextResponse.json({ error: "thumbnail lookup failed" }, { status: 500 });
  }
}
