"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import BookingsTab from "@/components/tabs/BookingsTab";
import ItineraryTab from "@/components/tabs/ItineraryTab";
import MapTab from "@/components/tabs/MapTab";
import InfoTab from "@/components/tabs/InfoTab";
import ChecklistTab from "@/components/tabs/ChecklistTab";
import ExpensesTab from "@/components/tabs/ExpensesTab";
import { THEME_COLORS } from "@/lib/theme";

const TABS = [
  { id: "bookings", label: "예약", icon: "✈️", color: "var(--coral)" },
  { id: "map", label: "지도", icon: "📍", color: "var(--mint)" },
  { id: "itinerary", label: "일정", icon: "🗓️", color: "var(--sky)" },
  { id: "info", label: "정보", icon: "⚡", color: "var(--yellow)" },
  { id: "checklist", label: "체크", icon: "✅", color: "var(--pink)" },
  { id: "expenses", label: "지출", icon: "💰", color: "var(--lime)" },
];

export default function TripPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const trip = useQuery(api.trips.getByShareId, { shareId });
  const participants = useQuery(api.participants.listByTrip, trip ? { tripId: trip._id } : "skip");
  const addParticipant = useMutation(api.participants.add);
  const removeParticipant = useMutation(api.participants.remove);
  const updateNickname = useMutation(api.participants.updateNickname);
  const updateTrip = useMutation(api.trips.update);

  const [nickname, setNickname] = useState("");
  const [inputNickname, setInputNickname] = useState("");
  const [selectedOldNickname, setSelectedOldNickname] = useState<string | null>(null);
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
    
    try {
      // 닉네임 수정 기능 제거: 무조건 참여자로 추가 (내부적으로 이미 존재하면 해당 레코드 사용)
      await addParticipant({ tripId: trip._id, nickname: name });
      
      localStorage.setItem(`nickname_${shareId}`, name);
      setNickname(name);
      setSelectedOldNickname(null);
    } catch (error: any) {
      console.error("닉네임 설정 중 오류 발생:", error);
      alert("닉네임 설정 중 오류가 발생했습니다: " + error.message);
    }
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--bg-primary)" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ background: theme.bg, borderRadius: "28px 28px 0 0", padding: "40px 32px 28px", color: theme.text, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
            <div style={{ position: "absolute", bottom: -30, left: -30, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
            <p style={{ letterSpacing: 3, fontSize: "0.72rem", marginBottom: 12, color: theme.muted, textTransform: "uppercase", fontWeight: 700 }}>Trip Invitation</p>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{trip.coverEmoji || "✈️"}</div>
            <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: 6, color: "#fff", lineHeight: 1.15, letterSpacing: "-0.02em" }}>{trip.title}</h1>
            <p style={{ color: theme.muted, fontSize: "0.88rem", fontWeight: 500 }}>📍 {trip.destination}</p>
            <p style={{ color: theme.muted, fontSize: "0.82rem", marginTop: 4, fontWeight: 500 }}>{trip.startDate} ~ {trip.endDate}</p>
          </div>
          <div style={{ background: "#ffffff", borderRadius: "0 0 28px 28px", padding: 32, boxShadow: "0 20px 48px -12px rgba(0,0,0,0.12)", border: "2px solid rgba(0,0,0,0.06)", borderTop: "none" }}>
            <h2 style={{ fontWeight: 800, marginBottom: 6, fontSize: "1.1rem", letterSpacing: "-0.01em" }}>닉네임을 설정해주세요 👋</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", marginBottom: 22, fontWeight: 500 }}>다른 참여자들이 나를 알아볼 수 있어요</p>
            <form onSubmit={handleSetNickname} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label>나의 닉네임</label>
                <input className="input" placeholder="예: 지훈, 민지, 여행왕" value={inputNickname}
                  onChange={(e) => setInputNickname(e.target.value)} autoFocus maxLength={20} required />
              </div>

              {participants && participants.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>또는 기존 참여자 닉네임 이어서 사용하기</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {participants.map(p => {
                      const isSelected = selectedOldNickname === p.nickname;
                      return (
                        <button key={p._id} type="button"
                          onClick={() => {
                            setInputNickname(p.nickname);
                            setSelectedOldNickname(p.nickname);
                          }}
                          style={{
                            padding: "7px 16px", borderRadius: 999, fontSize: "0.82rem", fontWeight: 700,
                            background: isSelected ? "var(--accent)" : "rgba(0,0,0,0.04)",
                            color: isSelected ? "#fff" : "var(--text-secondary)",
                            border: `2px solid ${isSelected ? "var(--accent)" : "rgba(0,0,0,0.08)"}`,
                            cursor: "pointer", transition: "all 0.15s"
                          }}>
                          👤 {p.nickname}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button className="btn-primary" type="submit" style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: "1rem" }}>
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      {/* 헤더 */}
      <header style={{ background: theme.bg, color: theme.text, padding: "18px 16px 16px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}>
          {/* 상단: 관리자 버튼 */}
          {isAdmin && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, gap: 6 }}>
              <span className="badge" style={{ background: "rgba(0,0,0,0.1)", color: theme.text, fontSize: "0.7rem", fontWeight: 800 }}>
                👑 관리자
              </span>
              <button onClick={() => window.location.href = '/admin'}
                style={{ padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, color: theme.text, border: `2px solid rgba(0,0,0,0.2)`, borderRadius: 999, background: "transparent", cursor: "pointer", transition: "all 0.15s" }}>
                🏠 홈
              </button>
            </div>
          )}

          {/* 여행 정보 */}
          <p style={{ letterSpacing: 3, fontSize: "0.7rem", marginBottom: 8, color: theme.muted, textTransform: "uppercase", fontWeight: 800 }}>
            {trip.tripType || "FRIENDS TRIP"} · {trip.startDate.substring(0, 4)}
          </p>
          <h1 style={{ fontWeight: 900, fontSize: "clamp(1.5rem, 6vw, 2.6rem)", lineHeight: 1.08, marginBottom: 8, color: theme.text, letterSpacing: "-0.02em" }}>
            {trip.title}
          </h1>
          <p style={{ fontSize: "clamp(0.85rem, 3vw, 1.05rem)", fontWeight: 700, opacity: 0.8, marginBottom: 4, color: theme.text }}>
            {trip.destination}
          </p>
          <p style={{ fontSize: "0.8rem", color: theme.muted, marginBottom: 12, fontWeight: 700 }}>
            {trip.startDate} ~ {trip.endDate}
          </p>

          {/* 참여자 뱃지 + 닉네임 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {participants?.map(p => (
                <div key={p._id} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.1)", color: theme.text, padding: "5px 12px", fontSize: "0.74rem", fontWeight: 800, borderRadius: 999 }}>
                  <span>{p.nickname}</span>
                  {isAdmin && (
                    <button onClick={() => { if (confirm(`'${p.nickname}' 참가자를 삭제하시겠습니까?`)) removeParticipant({ participantId: p._id }); }}
                      style={{ background: "transparent", border: "none", color: theme.text, opacity: 0.5, cursor: "pointer", padding: "0 2px", fontSize: "0.7rem", fontWeight: 900 }}>✕</button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: "0.8rem", opacity: 0.85, color: theme.text, fontWeight: 600 }}>
                <span style={{ opacity: 0.7 }}>닉네임 </span>
                <strong style={{ fontWeight: 800 }}>{nickname}</strong>
              </span>
              <button style={{ padding: "4px 10px", fontSize: "0.7rem", fontWeight: 800, color: theme.muted, border: `2px solid rgba(0,0,0,0.2)`, borderRadius: 999, background: "transparent", cursor: "pointer", transition: "all 0.15s" }}
                onClick={() => { 
                  localStorage.removeItem(`nickname_${shareId}`); 
                  setSelectedOldNickname(null);
                  setInputNickname("");
                  setNickname(""); 
                  window.location.reload();
                }}>
                변경
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="tab-nav-wrapper" style={{ padding: "14px 20px 0", background: "var(--bg-primary)", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(0,0,0,0.04)" }}>
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
      <main className="tab-content-safe-bottom" style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {activeTab === "bookings" && <BookingsTab trip={trip} nickname={nickname} />}
        {activeTab === "itinerary" && <ItineraryTab trip={trip} nickname={nickname} />}
        {activeTab === "map" && <MapTab trip={trip} />}
        {activeTab === "info" && <InfoTab trip={trip} />}
        {activeTab === "checklist" && <ChecklistTab trip={trip} nickname={nickname} />}
        {activeTab === "expenses" && <ExpensesTab trip={trip} nickname={nickname} />}
      </main>

      <div style={{ height: "env(safe-area-inset-bottom, 0)" }} />
    </div>
  );
}
