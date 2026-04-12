import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// POST /api/analyze-image
// body: { imageBase64: string, type: "flight" | "accommodation" | "expense" }
export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, type } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompts: Record<string, string> = {
      flight: `이 이미지는 항공권 또는 탑승권입니다. 다음 정보를 분석하여 JSON '배열' 형태로 모든 비행편을 추출해주세요. 여러 비행편이 있다면 한 번에 모두 추출해야 합니다:
[
  {
    "airline": "항공사 이름",
    "flightNumber": "편명 (예: KE123)",
    "departure": "출발 공항 및 터미널 (한국어로 번역해서 출력. 예: 인천국제공항 제1여객터미널)",
    "arrival": "도착 공항 및 터미널 (한국어로 번역해서 출력. 예: 다롄 저우수이쯔 국제공항)",
    "departureTime": "출발 시간 (HH:MM 형식)",
    "arrivalTime": "도착 시간 (HH:MM 형식)",
    "date": "날짜 (YYYY-MM-DD 형식)",
    "type": "outbound 또는 return (첫 번째 출국 여정은 outbound, 이후 되돌아오는 여정은 return)"
  }
]
반드시 위 JSON 배열 형식으로만 응답하고, 마크다운 텍스트나 다른 설명은 일절 추가하지 마세요.`,

      accommodation: `이 이미지는 호텔/숙소 예약 확인서입니다. 다음 정보를 JSON 형식으로 추출해주세요:
{
  "name": "숙소 이름",
  "address": "주소",
  "phone": "전화번호",
  "checkIn": "체크인 날짜 (YYYY-MM-DD 형식)",
  "checkOut": "체크아웃 날짜 (YYYY-MM-DD 형식)",
  "confirmationNumber": "예약 번호 또는 확인 번호"
}
정보를 찾을 수 없는 필드는 빈 문자열("")로 반환하세요. JSON만 반환하고 다른 설명은 하지 마세요.`,

      expense: `이 이미지는 지출 영수증 또는 결제 내역입니다. 다음 정보를 분석하여 JSON '배열' 형태로 모든 지출(세부 항목)을 추출해주세요. 품목이 여러 개면 한 번에 모두 추출해야 합니다:
[
  {
    "title": "지출 내용 요약 (예: 스시 저녁, 모닝 커피)",
    "amount": 숫자 금액 (단위/콤마 제외. 예: 1500),
    "date": "결제 날짜 (YYYY-MM-DD 형식. 영수증에 연도가 없으면 올해 연도로 적용)",
    "category": "food, transport, accommodation, activity, other 중 가장 적합한 하나"
  }
]
반드시 위 JSON 배열 형식으로만 응답하고, 마크다운 텍스트나 다른 설명은 일절 추가하지 마세요.`,
    };

    const prompt = prompts[type] || prompts.expense;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: imageBase64,
        },
      },
    ]);

    const text = result.response.text().trim();

    // JSON 파싱 (마크다운 제거 및 예외 처리)
    let jsonStr = text.replace(/```[a-zA-Z]*\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      const firstBracket = jsonStr.indexOf('[');
      const lastBracket = jsonStr.lastIndexOf(']');
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      
      try {
        if ((type === 'flight' || type === 'expense') && firstBracket !== -1 && lastBracket !== -1) {
          parsed = JSON.parse(jsonStr.substring(firstBracket, lastBracket + 1));
        } else if (firstBrace !== -1 && lastBrace !== -1) {
          parsed = JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
        } else {
          throw new Error("No format found");
        }
      } catch (innerErr) {
        throw new Error("AI 응답에서 정보를 찾을 수 없습니다: " + text.substring(0, 100));
      }
    }

    if (type === 'flight' || type === 'expense') {
      if (!Array.isArray(parsed)) parsed = [parsed];
    } else {
      if (Array.isArray(parsed)) parsed = parsed[0];
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: any) {
    console.error("이미지 분석 오류:", err);
    return NextResponse.json({ error: `이미지 분석 에러: ${err.message}` }, { status: 500 });
  }
}
