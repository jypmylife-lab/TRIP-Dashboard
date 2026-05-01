"use client";
import { useEffect, useState } from "react";

// 주요 도시 → IANA timezone 매핑
const CITY_TIMEZONE: Record<string, string> = {
  "tokyo": "Asia/Tokyo", "osaka": "Asia/Tokyo", "kyoto": "Asia/Tokyo", "fukuoka": "Asia/Tokyo",
  "paris": "Europe/Paris", "london": "Europe/London", "rome": "Europe/Rome",
  "new york": "America/New_York", "los angeles": "America/Los_Angeles", "chicago": "America/Chicago",
  "bangkok": "Asia/Bangkok", "singapore": "Asia/Singapore", "hong kong": "Asia/Hong_Kong",
  "taipei": "Asia/Taipei", "beijing": "Asia/Shanghai", "shanghai": "Asia/Shanghai",
  "sydney": "Australia/Sydney", "melbourne": "Australia/Melbourne",
  "hawaii": "Pacific/Honolulu", "guam": "Pacific/Guam", "saipan": "Pacific/Guam",
  "dubai": "Asia/Dubai", "istanbul": "Europe/Istanbul", "barcelona": "Europe/Madrid",
  "berlin": "Europe/Berlin", "amsterdam": "Europe/Amsterdam", "prague": "Europe/Prague",
  "vienna": "Europe/Vienna", "zurich": "Europe/Zurich", "manila": "Asia/Manila",
  "hanoi": "Asia/Ho_Chi_Minh", "ho chi minh": "Asia/Ho_Chi_Minh", "다낭": "Asia/Ho_Chi_Minh",
  "도쿄": "Asia/Tokyo", "오사카": "Asia/Tokyo", "교토": "Asia/Tokyo", "후쿠오카": "Asia/Tokyo",
  "파리": "Europe/Paris", "런던": "Europe/London", "로마": "Europe/Rome",
  "뉴욕": "America/New_York", "방콕": "Asia/Bangkok", "싱가포르": "Asia/Singapore",
  "홍콩": "Asia/Hong_Kong", "타이베이": "Asia/Taipei", "시드니": "Australia/Sydney",
  "하와이": "Pacific/Honolulu", "괌": "Pacific/Guam", "두바이": "Asia/Dubai",
  "세부": "Asia/Manila", "보라카이": "Asia/Manila", "발리": "Asia/Makassar",
  "나트랑": "Asia/Ho_Chi_Minh", "하노이": "Asia/Ho_Chi_Minh", "호치민": "Asia/Ho_Chi_Minh",
};

function findTimezone(destination: string): string | null {
  const lower = destination.toLowerCase().trim();
  for (const [city, tz] of Object.entries(CITY_TIMEZONE)) {
    if (lower.includes(city)) return tz;
  }
  return null;
}

// 통화 표시명
const CURRENCY_NAMES: Record<string, string> = {
  USD: "미국 달러", EUR: "유로", JPY: "일본 엔", GBP: "영국 파운드",
  CNY: "중국 위안", THB: "태국 바트", SGD: "싱가포르 달러", AUD: "호주 달러",
  HKD: "홍콩 달러", TWD: "대만 달러", VND: "베트남 동", PHP: "필리핀 페소",
  MYR: "말레이시아 링깃", IDR: "인도네시아 루피아", AED: "UAE 디르함",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", JPY: "¥", GBP: "£", CNY: "¥", THB: "฿", KRW: "₩",
};

interface WeatherData {
  city: string; country: string;
  timezoneOffset?: number;
  current: { temp: number; feelsLike: number; humidity: number; icon: string; description: string; windSpeed: number; };
  forecast: { date: string; minTemp: number; maxTemp: number; icon: string; description: string; }[];
}

export default function InfoTab({ trip }: { trip: any }) {
  // ─── 날씨 ─────────
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [city, setCity] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`weatherCity_${trip._id}`) || trip.destination.split(" ").pop() || trip.destination;
    }
    return trip.destination.split(" ").pop() || trip.destination;
  });

  // ─── 시차 ─────────
  const [koreaTime, setKoreaTime] = useState("");
  const [localTime, setLocalTime] = useState("");
  const timezone = findTimezone(trip.destination);

  // ─── 환율 ─────────
  const [rate, setRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [calcAmount, setCalcAmount] = useState("");
  const [calcDirection, setCalcDirection] = useState<"toKRW" | "fromKRW">("toKRW");

  // 날씨 조회
  async function fetchWeather(q: string) {
    setWeatherLoading(true); setWeatherError("");
    try {
      if (typeof window !== "undefined") localStorage.setItem(`weatherCity_${trip._id}`, q);
      const res = await fetch(`/api/weather?city=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "날씨 조회 실패");
      setWeatherData(json);
    } catch (e: any) { setWeatherError(e.message); }
    finally { setWeatherLoading(false); }
  }

  // 환율 조회
  async function fetchRate() {
    if (!trip.currency || trip.currency === "KRW") return;
    setRateLoading(true);
    try {
      const res = await fetch(`/api/exchange-rate?base=${trip.currency}`);
      const json = await res.json();
      if (json.ok) { setRate(json.rate); setIsFallback(json.isFallback || false); }
    } catch (e) { /* ignore */ }
    finally { setRateLoading(false); }
  }

  useEffect(() => { fetchWeather(city); fetchRate(); }, []);

  // 시차 실시간 시계
  const offsetSeconds = weatherData?.timezoneOffset;
  useEffect(() => {
    function update() {
      const now = new Date();
      setKoreaTime(now.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      if (timezone) {
        setLocalTime(now.toLocaleTimeString("ko-KR", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      } else if (offsetSeconds !== undefined) {
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const local = new Date(utc + offsetSeconds * 1000);
        setLocalTime(local.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      }
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timezone, offsetSeconds]);

  function getTimeDiff(): string {
    if (timezone) {
      const now = new Date();
      const koreaOffset = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getTime();
      const localOffset = new Date(now.toLocaleString("en-US", { timeZone: timezone })).getTime();
      const diffHours = Math.round((localOffset - koreaOffset) / 3600000);
      if (diffHours === 0) return "한국과 같은 시간대";
      return diffHours > 0 ? `한국보다 ${diffHours}시간 빠름` : `한국보다 ${Math.abs(diffHours)}시간 느림`;
    } else if (offsetSeconds !== undefined) {
      const diffHours = (offsetSeconds - 32400) / 3600;
      if (diffHours === 0) return "한국과 같은 시간대";
      return diffHours > 0 ? `한국보다 ${diffHours}시간 빠름` : `한국보다 ${Math.abs(diffHours)}시간 느림`;
    }
    return "";
  }

  function weatherEmoji(icon: string) {
    if (icon.includes("01")) return "☀️"; if (icon.includes("02") || icon.includes("03")) return "🌤️";
    if (icon.includes("04")) return "☁️"; if (icon.includes("09") || icon.includes("10")) return "🌧️";
    if (icon.includes("11")) return "⛈️"; if (icon.includes("13")) return "❄️"; return "🌫️";
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
  }

  const calcResult = calcAmount && rate ? (calcDirection === "toKRW"
    ? `${(parseFloat(calcAmount) * rate).toLocaleString("ko-KR", { maximumFractionDigits: 0 })} ₩`
    : `${(parseFloat(calcAmount) / rate).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} ${trip.currency}`) : "";

  const sym = CURRENCY_SYMBOLS[trip.currency] || trip.currency;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.02em" }}>ℹ️ 여행 정보</h2>

      {/* ═══ 날씨 정보 ═══ */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input className="input" placeholder="도시명 입력 (영문 또는 한글)" value={city}
          onChange={e => setCity(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchWeather(city)}
          style={{ flex: 1 }} />
        <button className="btn-primary" onClick={() => fetchWeather(city)} disabled={weatherLoading} style={{ whiteSpace: "nowrap" }}>
          {weatherLoading ? <span className="spinner" /> : "날씨 조회"}
        </button>
      </div>

      {weatherError && <div style={{ padding: "12px 16px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, color: "var(--danger)", fontSize: "0.85rem" }}>{weatherError}</div>}
      {weatherLoading && !weatherData && <div style={{ textAlign: "center", padding: 60 }}><span className="spinner" style={{ margin: "0 auto", width: 32, height: 32 }} /></div>}

      {weatherData && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="glass" style={{ padding: 28, background: "linear-gradient(135deg, #1a1a1a 0%, #333333 100%)", color: "#fff", border: "none", borderRadius: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, position: "relative" }}>
              <div>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.84rem", marginBottom: 6, fontWeight: 600 }}>📍 {weatherData.city}, {weatherData.country} · 현재 날씨</p>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 64 }}>{weatherEmoji(weatherData.current.icon)}</span>
                  <div>
                    <div style={{ fontSize: "3.2rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em" }}>{weatherData.current.temp}°</div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.92rem", marginTop: 4, textTransform: "capitalize", fontWeight: 600 }}>{weatherData.current.description}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "체감온도", value: `${weatherData.current.feelsLike}°C`, bg: "var(--coral)" },
                  { label: "습도", value: `${weatherData.current.humidity}%`, bg: "var(--sky)" },
                  { label: "풍속", value: `${weatherData.current.windSpeed} m/s`, bg: "var(--mint)" },
                ].map(item => (
                  <div key={item.label} style={{ background: item.bg, borderRadius: 12, padding: "8px 16px", textAlign: "center", color: "#1a1a1a" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, marginBottom: 1, opacity: 0.7 }}>{item.label}</div>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h3 style={{ fontWeight: 800, fontSize: "0.98rem", color: "var(--text-secondary)", marginTop: 8, letterSpacing: "-0.01em" }}>
            여행 일정 날씨 예보 ({trip.startDate} ~ {trip.endDate})
          </h3>
          {(() => {
            const valid = weatherData.forecast.filter(d => d.date >= trip.startDate && d.date <= trip.endDate);
            if (valid.length === 0) return (
              <div className="glass" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", borderRadius: 12 }}>
                현재 여행 일정이 기상청 예보 제공 범위(향후 5일)를 벗어나 아직 데이터를 제공할 수 없습니다.
              </div>
            );
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                {valid.map((day, i) => {
                  const bgColors = ["var(--mint)", "var(--yellow)", "var(--coral)", "var(--sky)", "var(--lavender)"];
                  return (
                  <div key={day.date} className="glass" style={{ padding: 16, textAlign: "center", borderRadius: 16, background: bgColors[i % bgColors.length], border: "2px solid rgba(0,0,0,0.06)", color: "#1a1a1a" }}>
                    <div style={{ fontSize: "0.74rem", color: "rgba(0,0,0,0.55)", marginBottom: 8, fontWeight: 700 }}>{formatDate(day.date)}</div>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{weatherEmoji(day.icon)}</div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 900 }}>{day.maxTemp}°</div>
                    <div style={{ fontSize: "0.82rem", color: "rgba(0,0,0,0.45)", fontWeight: 600 }}>{day.minTemp}°</div>
                    <div style={{ fontSize: "0.66rem", color: "rgba(0,0,0,0.5)", marginTop: 4, lineHeight: 1.3, fontWeight: 600 }}>{day.description}</div>
                  </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ 시차 정보 ═══ */}
      {(timezone || offsetSeconds !== undefined) && (
        <div className="glass" style={{ padding: 22, background: "var(--yellow)", color: "#1a1a1a", border: "2px solid rgba(0,0,0,0.08)", borderRadius: 20 }}>
          <div style={{ fontSize: "0.8rem", color: "rgba(0,0,0,0.5)", marginBottom: 12, fontWeight: 800 }}>🕐 시차 정보</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.74rem", color: "rgba(0,0,0,0.5)", marginBottom: 4, fontWeight: 700 }}>🇰🇷 한국</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{koreaTime}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.74rem", color: "rgba(0,0,0,0.5)", marginBottom: 4, fontWeight: 700 }}>📍 {trip.destination}</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{localTime}</div>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 10, fontSize: "0.84rem", color: "rgba(0,0,0,0.6)", background: "rgba(0,0,0,0.06)", padding: "6px 14px", borderRadius: 999, display: "inline-block", width: "100%", fontWeight: 700 }}>
            {getTimeDiff()}
          </div>
        </div>
      )}

      {/* ═══ 환율 정보 ═══ */}
      {trip.currency && trip.currency !== "KRW" && (
        <div className="glass" style={{ padding: 22, borderRadius: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 800 }}>💱 환율 정보</div>
            {isFallback && <span className="badge badge-yellow" style={{ fontSize: "0.62rem" }}>참고용 환율</span>}
          </div>
          {rateLoading ? (
            <div style={{ textAlign: "center", padding: 20 }}><span className="spinner" /></div>
          ) : rate ? (
            <>
              <div style={{ textAlign: "center", marginBottom: 16, padding: "18px", background: "var(--mint)", borderRadius: 16, color: "#1a1a1a" }}>
                <div style={{ fontSize: "0.82rem", color: "rgba(0,0,0,0.5)", marginBottom: 4, fontWeight: 700 }}>
                  1 {trip.currency} ({CURRENCY_NAMES[trip.currency] || trip.currency})
                </div>
                <div style={{ fontSize: "2.2rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
                  {rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} ₩
                </div>
              </div>
              {/* 환율 계산기 */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <input className="input" type="number" placeholder={calcDirection === "toKRW" ? `${sym} 금액 입력` : "₩ 금액 입력"}
                    value={calcAmount} onChange={e => setCalcAmount(e.target.value)} style={{ textAlign: "center", fontSize: "1rem", fontWeight: 600 }} />
                </div>
                <button onClick={() => setCalcDirection(d => d === "toKRW" ? "fromKRW" : "toKRW")}
                  style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.1)", background: "var(--yellow)", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800 }}>⇄</button>
                <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "rgba(0,0,0,0.03)", borderRadius: 12, fontSize: "1.05rem", fontWeight: 800, color: calcResult ? "var(--text-primary)" : "var(--text-muted)", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {calcResult || (calcDirection === "toKRW" ? "₩ ?" : `${sym} ?`)}
                </div>
              </div>
              <div style={{ textAlign: "center", marginTop: 6, fontSize: "0.68rem", color: "var(--text-muted)" }}>
                {calcDirection === "toKRW" ? `${trip.currency} → KRW` : `KRW → ${trip.currency}`}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: "0.85rem" }}>환율 정보를 불러올 수 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}
