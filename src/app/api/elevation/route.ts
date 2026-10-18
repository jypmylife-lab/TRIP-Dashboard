import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// GET /api/elevation?polyline=<encoded>&samples=40
// 인코딩된 폴리라인 경로를 따라 고도 샘플을 균등 간격으로 조회 (고도 그래프용)
export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Google Maps API 키가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const polyline = searchParams.get("polyline");
  const samples = searchParams.get("samples") || "40";

  if (!polyline) {
    return NextResponse.json({ error: "polyline이 필요합니다." }, { status: 400 });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/elevation/json?path=enc:${encodeURIComponent(polyline)}&samples=${samples}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") {
      return NextResponse.json({ error: data.error_message || data.status || "고도 조회에 실패했습니다." }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      points: (data.results || []).map((r: any) => ({
        elevation: r.elevation,
        lat: r.location?.lat,
        lng: r.location?.lng,
      })),
    });
  } catch (e) {
    console.warn("elevation lookup failed", e);
    return NextResponse.json({ error: "고도 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
