import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.INCHEON_AIRPORT_API_KEY;
const BASE_URL = "http://apis.data.go.kr/B551177/statusOfAllFltDeOdp/getFltDeparturesDeOdp";

// GET /api/checkin-counter?flightNumber=OZ132&date=2026-10-15&departure=ICN
// 인천국제공항공사 "항공기 운항 현황 상세 조회" API로 체크인 카운터를 조회 (인천 출발편만 지원)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const flightNumber = (searchParams.get("flightNumber") || "").replace(/\s+/g, "").toUpperCase();
  const date = searchParams.get("date") || "";
  const departure = (searchParams.get("departure") || "");

  if (!API_KEY) {
    return NextResponse.json({ error: "INCHEON_AIRPORT_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }
  if (!flightNumber) {
    return NextResponse.json({ error: "flightNumber가 필요합니다." }, { status: 400 });
  }
  if (!/icn|인천/i.test(departure)) {
    return NextResponse.json({ error: "인천국제공항 출발편만 자동 조회를 지원합니다." }, { status: 400 });
  }

  const dateDigits = date.replace(/-/g, "");

  try {
    const res = await fetch(`${BASE_URL}?serviceKey=${API_KEY}&type=json&numOfRows=15000&pageNo=1`);
    const data = await res.json();
    const header = data?.response?.header;
    if (!header || header.resultCode !== "00") {
      return NextResponse.json({ error: header?.returnAuthMsg || header?.resultMsg || "조회에 실패했습니다." }, { status: 502 });
    }

    const items: any[] = data?.response?.body?.items || [];
    const match = items.find(
      (it) => it.flightId === flightNumber && (!dateDigits || String(it.scheduleDatetime || "").startsWith(dateDigits))
    );

    if (!match || !match.chkinRange || match.chkinRange === "-") {
      return NextResponse.json({ error: "체크인 카운터 정보가 아직 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      checkInCounter: match.chkinRange,
      terminal: match.terminalId || null,
      gate: match.gateNumber || null,
    });
  } catch (e) {
    console.warn("checkin-counter lookup failed", e);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
