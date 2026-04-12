import { NextResponse } from "next/server";

// GET /api/exchange-rate?base=JPY
// 현재 환율을 조회해서 KRW 기준으로 반환
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const base = searchParams.get("base") || "USD";
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;

  if (!apiKey) {
    // API 키 없을 때 fallback 환율 (참고용)
    const fallback: Record<string, number> = {
      USD: 1340, EUR: 1470, JPY: 8.9, GBP: 1700,
      CNY: 184, THB: 37, SGD: 990, AUD: 870, HKD: 171,
    };
    const rate = fallback[base.toUpperCase()] || 1;
    return NextResponse.json({ ok: true, rate, base, target: "KRW", isFallback: true });
  }

  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/pair/${base}/KRW`);
    const data = await res.json();
    if (data.result !== "success") throw new Error("API 오류");
    return NextResponse.json({ ok: true, rate: data.conversion_rate, base, target: "KRW", isFallback: false });
  } catch {
    return NextResponse.json({ error: "환율 조회에 실패했습니다." }, { status: 500 });
  }
}
