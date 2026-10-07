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
  let resolvedName: string | undefined;
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (googleApiKey && city) {
    // 1. 구글 Geocoding으로 위경도 추출 (정식 지명에 강함)
    try {
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${googleApiKey}`);
      const geoData = await geoRes.json();
      if (geoData.results?.length > 0) {
        lat = geoData.results[0].geometry.location.lat;
        lng = geoData.results[0].geometry.location.lng;
        resolvedName = geoData.results[0].address_components?.[0]?.long_name;
      }
    } catch (e) {
      console.warn("Geocoding failed for weather API", e);
    }

    // 2. Geocoding이 못 찾으면 Places API로 재시도 (한글 음차 지명 등 구어체 표기에 강함, 예: "가오슝")
    if (lat === undefined) {
      try {
        const placeRes = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(city)}&inputtype=textquery&fields=geometry,name&key=${googleApiKey}`);
        const placeData = await placeRes.json();
        if (placeData.candidates?.length > 0) {
          lat = placeData.candidates[0].geometry.location.lat;
          lng = placeData.candidates[0].geometry.location.lng;
          resolvedName = placeData.candidates[0].name;
        }
      } catch (e) {
        console.warn("Places lookup failed for weather API", e);
      }
    }
  }

  if (lat === undefined && /[^\x00-\x7F]/.test(city)) {
    // 위경도를 못 찾았는데 도시명이 비영문이면 OpenWeatherMap도 못 찾을 게 거의 확실함
    return NextResponse.json({ error: `도시를 찾을 수 없습니다: ${city}` }, { status: 404 });
  }

  try {
    const locationParam = lat !== undefined && lng !== undefined
      ? `lat=${lat}&lon=${lng}`
      : `q=${encodeURIComponent(city)}`;

    // 실시간 현재 날씨 + 5일 예보를 각각의 전용 엔드포인트에서 조회
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?appid=${apiKey}&units=metric&lang=kr&${locationParam}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?appid=${apiKey}&units=metric&lang=kr&cnt=40&${locationParam}`),
    ]);
    const [currentData, forecastData] = await Promise.all([currentRes.json(), forecastRes.json()]);

    if (String(currentData.cod) !== "200" || forecastData.cod !== "200") {
      return NextResponse.json({ error: `도시를 찾을 수 없습니다: ${city}` }, { status: 404 });
    }

    // 날짜별로 그룹화 (5일 예보)
    const daily: Record<string, { temps: number[]; icon: string; description: string }> = {};
    for (const item of forecastData.list) {
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

    return NextResponse.json({
      ok: true,
      city: resolvedName || currentData.name || forecastData.city.name,
      country: currentData.sys?.country || forecastData.city.country,
      timezoneOffset: currentData.timezone ?? forecastData.city.timezone,
      current: {
        temp: Math.round(currentData.main.temp),
        feelsLike: Math.round(currentData.main.feels_like),
        humidity: currentData.main.humidity,
        icon: currentData.weather[0].icon,
        description: currentData.weather[0].description,
        windSpeed: currentData.wind.speed,
      },
      forecast,
    });
  } catch {
    return NextResponse.json({ error: "날씨 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
