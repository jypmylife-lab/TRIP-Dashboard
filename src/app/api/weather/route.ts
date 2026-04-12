import { NextResponse } from "next/server";

// GET /api/weather?city=Osaka
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "Seoul";
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENWEATHER_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=kr&cnt=40`
    );
    const data = await res.json();

    if (data.cod !== "200") {
      return NextResponse.json({ error: `도시를 찾을 수 없습니다: ${city}` }, { status: 404 });
    }

    // 날짜별로 그룹화 (5일 예보)
    const daily: Record<string, { temps: number[]; icon: string; description: string }> = {};
    for (const item of data.list) {
      const date = item.dt_txt.split(" ")[0];
      if (!daily[date]) daily[date] = { temps: [], icon: item.weather[0].icon, description: item.weather[0].description };
      daily[date].temps.push(item.main.temp);
      if (item.dt_txt.includes("12:00:00")) {
        daily[date].icon = item.weather[0].icon;
        daily[date].description = item.weather[0].description;
      }
    }

    const forecast = Object.entries(daily).slice(0, 5).map(([date, v]) => ({
      date,
      minTemp: Math.round(Math.min(...v.temps)),
      maxTemp: Math.round(Math.max(...v.temps)),
      icon: v.icon,
      description: v.description,
    }));

    const current = data.list[0];
    return NextResponse.json({
      ok: true,
      city: data.city.name,
      country: data.city.country,
      current: {
        temp: Math.round(current.main.temp),
        feelsLike: Math.round(current.main.feels_like),
        humidity: current.main.humidity,
        icon: current.weather[0].icon,
        description: current.weather[0].description,
        windSpeed: current.wind.speed,
      },
      forecast,
    });
  } catch {
    return NextResponse.json({ error: "날씨 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
