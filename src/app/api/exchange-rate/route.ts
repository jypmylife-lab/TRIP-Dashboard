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
    // 같은 통화 요청은 3시간 동안 Vercel CDN에서 공유 캐시되어, 탭을 열 때마다 매번 새로 호출하지 않도록 함
    // (무료 플랜 월 호출 한도가 넉넉하지 않아 캐싱 없이는 금방 소진될 수 있음)
    return NextResponse.json(
      { ok: true, rate: data.conversion_rate, base, target: "KRW", isFallback: false },
      { headers: { "Cache-Control": "public, max-age=10800, s-maxage=10800, stale-while-revalidate=3600" } }
    );
  } catch {
    return NextResponse.json({ error: "환율 조회에 실패했습니다." }, { status: 500 });
  }
}
