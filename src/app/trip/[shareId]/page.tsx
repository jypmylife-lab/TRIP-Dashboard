"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import BookingsTab from "@/components/tabs/BookingsTab";
import MapTab from "@/components/tabs/MapTab";
import WeatherTab from "@/components/tabs/WeatherTab";
import ChecklistTab from "@/components/tabs/ChecklistTab";
import ExpensesTab from "@/components/tabs/ExpensesTab";
import { THEME_COLORS } from "@/lib/theme";

const TABS = [
  { id: "bookings", label: "예약", icon: "🎫" },
  { id: "map", label: "지도", icon: "🗺️" },
  { id: "weather", label: "날씨", icon: "⛅" },
  { id: "checklist", label: "체크", icon: "📋" },
  { id: "expenses", label: "지출", icon: "💸" },
];

export default function TripPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const trip = useQuery(api.trips.getByShareId, { shareId });
  const participants = useQuery(api.participants.listByTrip, trip ? { tripId: trip._id } : "skip");
  const addParticipant = useMutation(api.participants.add);
  const updateTrip = useMutation(api.trips.update);

  const [nickname, setNickname] = useState("");
  const [inputNickname, setInputNickname] = useState("");
  const [activeTab, setActiveTab] = useState("bookings");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("adminToken");
    if (token) setIsAdmin(true);
    const saved = localStorage.getItem(`nickname_${shareId}`);
    if (saved) setNickname(saved);
  }, [shareId]);

  async function handleSetNickname(e: React.FormEvent) {
    e.preventDefault();
    if (!inputNickname.trim() || !trip) return;
    const name = inputNickname.trim();
    localStorage.setItem(`nickname_${shareId}`, name);
    setNickname(name);
    await addParticipant({ tripId: trip._id, nickname: name });
  }

  const currentThemeColor = trip?.themeColor;
  const theme = THEME_COLORS.find(c => c.bg === currentThemeColor) || THEME_COLORS[0];
  if (trip === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  // 여행 없음
  if (trip === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 64 }}>🔒</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>존재하지 않는 여행입니다</h1>
        <p style={{ color: "var(--text-muted)" }}>링크를 다시 확인해주세요.</p>
      </div>
    );
  }

  // 닉네임 입력 화면
  if (!nickname) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ background: theme.bg, borderRadius: "20px 20px 0 0", padding: "36px 36px 24px", color: theme.text }}>
            <p style={{ letterSpacing: 4, fontSize: "0.7rem", marginBottom: 8, color: theme.muted, textTransform: "uppercase" }}>Trip Invitation</p>
            <div style={{ fontSize: 52, marginBottom: 12 }}>{trip.coverEmoji || "✈️"}</div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 4, color: "#fff", lineHeight: 1.2 }}>{trip.title}</h1>
            <p style={{ color: theme.muted, fontSize: "0.85rem" }}>📍 {trip.destination}</p>
            <p style={{ color: theme.muted, fontSize: "0.8rem", marginTop: 4 }}>{trip.startDate} ~ {trip.endDate}</p>
          </div>
          <div style={{ background: "#ffffff", borderRadius: "0 0 20px 20px", padding: 36, boxShadow: "0 20px 40px -8px rgba(0,0,0,0.12)" }}>
            <h2 style={{ fontWeight: 700, marginBottom: 6, fontSize: "1.05rem" }}>닉네임을 설정해주세요 👋</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: 20 }}>다른 참여자들이 나를 알아볼 수 있어요</p>
            <form onSubmit={handleSetNickname} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label>나의 닉네임</label>
                <input className="input" placeholder="예: 지훈, 민지, 여행왕" value={inputNickname}
                  onChange={(e) => setInputNickname(e.target.value)} autoFocus maxLength={20} required />
              </div>

              {participants && participants.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>또는 기존 참여자 닉네임 이어서 사용하기</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {participants.map(p => (
                      <button key={p._id} type="button"
                        onClick={() => setInputNickname(p.nickname)}
                        style={{
                          padding: "6px 14px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 700,
                          background: inputNickname === p.nickname ? "var(--accent)" : "rgba(99,102,241,0.06)",
                          color: inputNickname === p.nickname ? "#fff" : "var(--accent)",
                          border: `1px solid ${inputNickname === p.nickname ? "var(--accent)" : "transparent"}`,
                          cursor: "pointer", transition: "all 0.15s"
                        }}>
                        👤 {p.nickname}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn-primary" type="submit" style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: "0.95rem" }}>
                입장하기 🚀
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 메인 대시보드
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 바우처 스타일 헤더 */}
      <header style={{ background: theme.bg, color: theme.text, padding: "16px 16px 14px", position: "relative" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* 상단: 관리자 버튼 (우측) */}
          {isAdmin && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, gap: 6 }}>
              <span className="badge" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: "0.68rem" }}>
                👑 관리자
              </span>
              <button onClick={() => window.location.href = '/admin'}
                style={{ padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700, color: "#fff", border: "none", borderRadius: 6, background: "rgba(255,255,255,0.25)", cursor: "pointer" }}>
                🏠 홈
              </button>
            </div>
          )}

          {/* 여행 정보 */}
          <p style={{ letterSpacing: 3, fontSize: "0.68rem", marginBottom: 6, color: theme.muted, textTransform: "uppercase" }}>
            {trip.tripType || "FRIENDS TRIP"} · {trip.startDate.substring(0, 4)}
          </p>
          <h1 style={{ fontWeight: 800, fontSize: "clamp(1.4rem, 6vw, 2.4rem)", lineHeight: 1.1, marginBottom: 8, color: "#fff" }}>
            {trip.title}
          </h1>
          <p style={{ fontSize: "clamp(0.8rem, 3vw, 1rem)", fontWeight: 400, opacity: 0.6, marginBottom: 4, color: "#fff" }}>
            {trip.destination}
          </p>
          <p style={{ fontSize: "0.78rem", color: theme.muted, marginBottom: 10 }}>
            {trip.startDate} ~ {trip.endDate}
          </p>

          {/* 참여자 뱃지 + 닉네임 한 줄 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {participants?.map(p => (
                <div key={p._id} style={{
                  background: theme.badge, color: theme.bg,
                  padding: "4px 10px", fontSize: "0.72rem", fontWeight: 800, borderRadius: 4
                }}>
                  {p.nickname}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: "0.78rem", opacity: 0.8, color: "#fff" }}>
                <span style={{ opacity: 0.6 }}>닉네임 </span>
                <strong>{nickname}</strong>
              </span>
              <button style={{ padding: "3px 8px", fontSize: "0.68rem", color: theme.muted, border: `1px solid rgba(255,255,255,0.2)`, borderRadius: 6, background: "transparent", cursor: "pointer" }}
                onClick={() => { localStorage.removeItem(`nickname_${shareId}`); setNickname(""); }}>
                변경
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 — PC: sticky 상단, 모바일: fixed 하단 */}
      <div className="tab-nav-wrapper" style={{ padding: "14px 20px 0", background: "var(--bg-primary)", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="tabs">
            {TABS.map((tab) => (
              <button key={tab.id} className={`tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}>
                <span style={{ fontSize: 18 }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <main className="tab-content-safe-bottom" style={{ flex: 1, padding: "24px 16px 48px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {activeTab === "bookings" && <BookingsTab trip={trip} nickname={nickname} />}
        {activeTab === "map" && <MapTab trip={trip} />}
        {activeTab === "weather" && <WeatherTab trip={trip} />}
        {activeTab === "checklist" && <ChecklistTab trip={trip} nickname={nickname} />}
        {activeTab === "expenses" && <ExpensesTab trip={trip} nickname={nickname} />}
      </main>

      <div style={{ height: "env(safe-area-inset-bottom, 0)" }} />
    </div>
  );
}
