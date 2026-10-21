import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// GET /api/places-search?query=도톤보리 오사카
// 지도 링크 없이 이름만으로 장소를 추가할 때 좌표/평점을 가져옴 (Places API는 브라우저에서 직접 호출 시 CORS로 막히므로 서버에서 대신 호출)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!API_KEY || !query) {
    return NextResponse.json({ error: "query가 필요합니다." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=geometry,rating,user_ratings_total&key=${API_KEY}`);
    const data = await res.json();
    const candidate = data.candidates?.[0];

    return NextResponse.json({
      lat: candidate?.geometry?.location?.lat ?? null,
      lng: candidate?.geometry?.location?.lng ?? null,
      rating: typeof candidate?.rating === "number" ? candidate.rating : null,
      ratingsTotal: candidate?.user_ratings_total ?? null,
    });
  } catch (e) {
    console.warn("places-search failed", e);
    return NextResponse.json({ error: "검색 중 오류가 발생했습니다." }, { status: 500 });
  }
}
