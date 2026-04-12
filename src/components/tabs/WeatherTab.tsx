"use client";
import { useEffect, useState } from "react";

interface WeatherData {
  city: string; country: string;
  current: { temp: number; feelsLike: number; humidity: number; icon: string; description: string; windSpeed: number; };
  forecast: { date: string; minTemp: number; maxTemp: number; icon: string; description: string; }[];
}

export default function WeatherTab({ trip }: { trip: any }) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [city, setCity] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`weatherCity_${trip._id}`) || trip.destination.split(" ").pop() || trip.destination;
    }
    return trip.destination.split(" ").pop() || trip.destination;
  });

  async function fetchWeather(q: string) {
    setLoading(true); setError("");
    try {
      if (typeof window !== "undefined") localStorage.setItem(`weatherCity_${trip._id}`, q);
      const res = await fetch(`/api/weather?city=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "날씨 조회 실패");
      setData(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchWeather(city); }, []);

  function weatherEmoji(icon: string) {
    if (icon.includes("01")) return "☀️";
    if (icon.includes("02") || icon.includes("03")) return "🌤️";
    if (icon.includes("04")) return "☁️";
    if (icon.includes("09") || icon.includes("10")) return "🌧️";
    if (icon.includes("11")) return "⛈️";
    if (icon.includes("13")) return "❄️";
    return "🌫️";
  }

  function formatDate(d: string) {
    const date = new Date(d);
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.1rem" }}>⛅ 날씨</h2>
      </div>

      {/* 도시 검색 */}
      <div style={{ display: "flex", gap: 10 }}>
        <input className="input" placeholder="도시명 입력 (영문 또는 한글)" value={city}
          onChange={e => setCity(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchWeather(city)}
        />
        <button className="btn-primary" onClick={() => fetchWeather(city)} disabled={loading} style={{ whiteSpace: "nowrap" }}>
          {loading ? <span className="spinner" /> : "조회"}
        </button>
      </div>

      {error && <div style={{ padding: "12px 16px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, color: "var(--danger)", fontSize: "0.85rem" }}>{error}</div>}

      {loading && !data && <div style={{ textAlign: "center", padding: 60 }}><span className="spinner" style={{ margin: "0 auto", width: 32, height: 32 }} /></div>}

      {data && (
        <>
          {/* 현재 날씨 */}
          <div className="glass" style={{ padding: 28, background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a9f 100%)", color: "#fff", border: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.82rem", marginBottom: 4 }}>
                  📍 {data.city}, {data.country} · 현재 날씨
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 64 }}>{weatherEmoji(data.current.icon)}</span>
                  <div>
                    <div style={{ fontSize: "3rem", fontWeight: 700, lineHeight: 1, color: "#fff" }}>{data.current.temp}°</div>
                    <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.9rem", marginTop: 4, textTransform: "capitalize" }}>{data.current.description}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "체감온도", value: `${data.current.feelsLike}°C` },
                  { label: "습도", value: `${data.current.humidity}%` },
                  { label: "풍속", value: `${data.current.windSpeed} m/s` },
                ].map(item => (
                  <div key={item.label} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 18px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.65)", marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontWeight: 600, fontSize: "1rem", color: "#fff" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 여정 날씨 (예보 필터) */}
          <h3 style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-secondary)", marginTop: 8 }}>
            여행 일정 날씨 예보 ({trip.startDate} ~ {trip.endDate})
          </h3>
          {(() => {
            const validForecasts = data.forecast.filter(day => day.date >= trip.startDate && day.date <= trip.endDate);
            if (validForecasts.length === 0) {
              return (
                <div className="glass" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", borderRadius: 12 }}>
                  현재 여행 일정이 기상청 예보 제공 범위(향후 5일)를 벗어나 아직 데이터를 제공할 수 없습니다.
                </div>
              );
            }
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                {validForecasts.map(day => (
                  <div key={day.date} className="glass" style={{ padding: 14, textAlign: "center", borderRadius: 12, background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>{formatDate(day.date)}</div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{weatherEmoji(day.icon)}</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{day.maxTemp}°</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{day.minTemp}°</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.3 }}>{day.description}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
