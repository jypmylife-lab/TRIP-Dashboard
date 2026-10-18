import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// POST /api/directions
// body: { origin: {lat,lng}, destination: {lat,lng}, waypoints: {lat,lng}[] }
// 신규 Routes API(computeRoutes)를 사용해 도보 경로의 인코딩된 폴리라인을 반환
export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Google Maps API 키가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const { origin, destination, waypoints } = await req.json();
    if (!origin || !destination) {
      return NextResponse.json({ error: "origin, destination이 필요합니다." }, { status: 400 });
    }

    const toWaypoint = (p: { lat: number; lng: number }) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: toWaypoint(origin),
        destination: toWaypoint(destination),
        intermediates: (waypoints || []).map(toWaypoint),
        travelMode: "WALK",
        polylineQuality: "OVERVIEW",
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.routes?.length) {
      console.warn("Routes API error:", data);
      return NextResponse.json({ error: data.error?.message || "경로를 찾을 수 없습니다." }, { status: res.status === 200 ? 404 : res.status });
    }

    const route = data.routes[0];
    return NextResponse.json({
      ok: true,
      encodedPolyline: route.polyline?.encodedPolyline,
      durationSeconds: route.duration ? parseInt(route.duration.replace("s", "")) : undefined,
      distanceMeters: route.distanceMeters,
    });
  } catch (e) {
    console.warn("directions route failed", e);
    return NextResponse.json({ error: "경로 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
