import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// 구글 표준 폴리라인(정밀도 5) 디코더
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

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
    // 긴 경로(여러 날짜의 이동 거리가 긴 경우)는 디코딩된 포인트 수가 많아지는데,
    // enc: 형식 그대로 넘기면 구글 Elevation API가 INVALID_REQUEST로 거부하는 경우가 있어
    // 직접 디코딩한 뒤 최대 100개 포인트로 균등하게 줄여서 일반 lat,lng 좌표 목록으로 보냄
    // (어차피 샘플 개수만큼만 표시하므로 정확도 손실은 그래프상 체감되지 않음)
    const points = decodePolyline(polyline);
    const MAX_POINTS = 100;
    const sampledPoints = points.length > MAX_POINTS
      ? Array.from({ length: MAX_POINTS }, (_, i) => points[Math.round((i / (MAX_POINTS - 1)) * (points.length - 1))])
      : points;
    const pathParam = sampledPoints.map(p => `${p.lat},${p.lng}`).join("|");

    const url = `https://maps.googleapis.com/maps/api/elevation/json?path=${encodeURIComponent(pathParam)}&samples=${samples}&key=${API_KEY}`;
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
