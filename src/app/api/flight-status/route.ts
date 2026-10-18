import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.AVIATIONSTACK_API_KEY;

// GET /api/flight-status?flightNumber=KE789
// AviationStack 실시간 항공편 조회 (터미널/게이트는 보통 출발 당일에만 제공됨)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const flightNumber = (searchParams.get("flightNumber") || "").replace(/\s+/g, "").toUpperCase();

  if (!API_KEY) {
    return NextResponse.json({ error: "AVIATIONSTACK_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }
  if (!flightNumber) {
    return NextResponse.json({ error: "flightNumber가 필요합니다." }, { status: 400 });
  }

  try {
    // 무료 플랜은 HTTPS를 지원하지 않아 HTTP로 호출
    const res = await fetch(`http://api.aviationstack.com/v1/flights?access_key=${API_KEY}&flight_iata=${encodeURIComponent(flightNumber)}`);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message || "항공편 조회에 실패했습니다." }, { status: 502 });
    }

    const flight = data.data?.[0];
    if (!flight) {
      return NextResponse.json({ error: "실시간 정보가 아직 없습니다. 보통 출발 당일(혹은 몇 시간 전)부터 게이트/터미널 정보가 제공됩니다." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      flightStatus: flight.flight_status,
      departure: {
        airport: flight.departure?.airport,
        terminal: flight.departure?.terminal || null,
        gate: flight.departure?.gate || null,
        scheduled: flight.departure?.scheduled,
        estimated: flight.departure?.estimated,
      },
      arrival: {
        airport: flight.arrival?.airport,
        terminal: flight.arrival?.terminal || null,
        gate: flight.arrival?.gate || null,
        scheduled: flight.arrival?.scheduled,
        estimated: flight.arrival?.estimated,
      },
    });
  } catch (e) {
    console.warn("flight-status lookup failed", e);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
