import { NextResponse } from "next/server";

// GET /api/weather?city=Osaka
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "Seoul";
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENWEATHER_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  let lat: number | undefined;
  let lng: number | undefined;
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // 1. 한글 등 다양한 언어 지원을 위해 구글 Geocoding으로 위경도 먼저 추출
  if (googleApiKey && city) {
    try {
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${googleApiKey}`);
      const geoData = await geoRes.json();
      if (geoData.results && geoData.results.length > 0) {
        lat = geoData.results[0].geometry.location.lat;
        lng = geoData.results[0].geometry.location.lng;
      }
    } catch (e) {
      console.warn("Geocoding failed for weather API", e);
    }
  }

  try {
    let weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?appid=${apiKey}&units=metric&lang=kr&cnt=40`;
    if (lat !== undefined && lng !== undefined) {
      weatherUrl += `&lat=${lat}&lon=${lng}`;
    } else {
      weatherUrl += `&q=${encodeURIComponent(city)}`;
    }
    
    const res = await fetch(weatherUrl);
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
      timezoneOffset: data.city.timezone,
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
