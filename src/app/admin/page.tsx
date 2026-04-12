"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { THEME_COLORS } from "@/lib/theme";

const CURRENCIES = [
  { code: "JPY", label: "일본 엔 (¥)" }, { code: "USD", label: "미국 달러 ($)" },
  { code: "EUR", label: "유로 (€)" }, { code: "THB", label: "태국 바트 (฿)" },
  { code: "SGD", label: "싱가포르 달러 (S$)" }, { code: "CNY", label: "중국 위안 (¥)" },
  { code: "GBP", label: "영국 파운드 (£)" }, { code: "AUD", label: "호주 달러 (A$)" },
  { code: "HKD", label: "홍콩 달러 (HK$)" },
];
const EMOJIS = ["🗺️","🏝️","🏔️","🌸","🍜","🎌","🗼","🌏","🏖️","🎭","🌃","🚂"];

export default function AdminPage() {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // 새 여행 만들기 폼 & 테마색상 관리
  const defaultForm = { 
    title: "", destination: "", startDate: "", endDate: "", 
    currency: "JPY", coverEmoji: "🗺️", themeColor: THEME_COLORS[0].bg, tripType: "Friends Trip"
  };
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);

  // 목록 필터 상태
  const [filterTheme, setFilterTheme] = useState("All");

  const trips = useQuery(api.trips.listAll);
  const createTrip = useMutation(api.trips.create);
  const removeTrip = useMutation(api.trips.remove);
  const updateTrip = useMutation(api.trips.update);

  useEffect(() => {
    const token = sessionStorage.getItem("adminToken");
    if (!token) { router.push("/admin/login"); return; }
    setIsAuth(true);
  }, [router]);

  function generateShareId() {
    return crypto.randomUUID();
  }

  function openCreateModal() {
    setForm(defaultForm);
    setEditingTripId(null);
    setShowForm(true);
  }

  function openEditModal(trip: any) {
    setForm({
      title: trip.title, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate,
      currency: trip.currency || "JPY", coverEmoji: trip.coverEmoji || "🗺️", 
      themeColor: trip.themeColor || THEME_COLORS[0].bg, tripType: trip.tripType || "Friends Trip"
    });
    setEditingTripId(trip._id);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editingTripId) {
      await updateTrip({ tripId: editingTripId as any, ...form });
    } else {
      await createTrip({ ...form, shareId: generateShareId() });
    }
    setSaving(false);
    setShowForm(false);
    setEditingTripId(null);
    setForm(defaultForm);
  }

  function handleCopyLink(shareId: string) {
    navigator.clipboard.writeText(`${window.location.origin}/trip/${shareId}`);
    alert("링크가 클립보드에 복사되었습니다!");
  }
  if (!isAuth) return null;

  return (
    <div style={{ minHeight: "100vh", padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>✈️ 여행 대시보드</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 4 }}>관리자 전용 — 전체 여행 목록</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" style={{ fontSize: "0.8rem" }} onClick={() => { sessionStorage.removeItem("adminToken"); router.push("/admin/login"); }}>로그아웃</button>
          <button className="btn-primary" onClick={openCreateModal}>
          + 새 여행 만들기
        </button>
        </div>
      </div>

      {/* 여행 테마 필터 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {["All", "Friends Trip", "Family Trip", "Couple Trip", "Solo Trip"].map(type => (
          <button key={type} onClick={() => setFilterTheme(type)}
            style={{
              padding: "6px 14px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap",
              border: `1px solid ${filterTheme === type ? "var(--accent)" : "rgba(0,0,0,0.08)"}`,
              background: filterTheme === type ? "var(--accent)" : "#ffffff",
              color: filterTheme === type ? "#ffffff" : "var(--text-secondary)",
              cursor: "pointer", transition: "all 0.15s"
            }}>
            {type === "All" ? "전체 보기" : type}
          </button>
        ))}
      </div>

      {/* 여행 목록 */}
      {trips === undefined ? (
        <div style={{ textAlign: "center", padding: 60 }}><span className="spinner" style={{ margin: "0 auto" }} /></div>
      ) : trips.length === 0 ? (
        <div className="glass" style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🗺️</div>
          <p style={{ fontSize: "1.1rem", fontWeight: 500 }}>아직 여행이 없습니다</p>
          <p style={{ fontSize: "0.85rem", marginTop: 8 }}>+ 새 여행 만들기 버튼을 눌러 시작하세요</p>
        </div>
      ) : (() => {
        // 필터 및 정렬
        const processedTrips = trips
          .filter(t => filterTheme === "All" || (t.tripType || "Friends Trip") === filterTheme)
          .sort((a, b) => b.startDate.localeCompare(a.startDate)); // 최신 여행이 위로 (내림차순)

        if (processedTrips.length === 0) {
          return (
            <div className="glass" style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <p>선택한 테마의 여행이 없습니다.</p>
            </div>
          );
        }

        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {processedTrips.map((trip) => {
              const currentTheme = THEME_COLORS.find(c => c.bg === trip.themeColor) || THEME_COLORS[0];

            return (
              <div key={trip._id} className="glass glass-hover" style={{ padding: 24, cursor: "pointer", position: "relative" }}
                onClick={() => router.push(`/trip/${trip.shareId}`)}>
                
                {/* 상단: 이모티콘 및 테마 색상 배지 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ fontSize: 40 }}>{trip.coverEmoji || "🗺️"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.03)", padding: "4px 8px", borderRadius: 99 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: currentTheme.bg, boxShadow: "0 0 0 1px rgba(0,0,0,0.1)" }} />
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)" }}>{currentTheme.label}</span>
                  </div>
                </div>

                <h2 style={{ fontWeight: 600, fontSize: "1.05rem", marginBottom: 4 }}>{trip.title}</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 12 }}>📍 {trip.destination}</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <span className="badge badge-purple">{trip.startDate}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", alignSelf: "center" }}>→</span>
                  <span className="badge badge-purple">{trip.endDate}</span>
                </div>

                {/* 하단 버튼 액션 영역 (이벤트 전파 방지) */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button className="btn-ghost" style={{ flex: 1, minWidth: "80px", justifyContent: "center", fontSize: "0.75rem", padding: "7px" }}
                    onClick={(e) => { e.stopPropagation(); openEditModal(trip); }}>
                    ✏️ 여행 수정
                  </button>
                  <button className="btn-ghost" style={{ flex: 1, minWidth: "80px", justifyContent: "center", fontSize: "0.75rem", padding: "7px", background: "rgba(99,102,241,0.05)", color: "var(--accent)" }}
                    onClick={(e) => { e.stopPropagation(); handleCopyLink(trip.shareId); }}>
                    🔗 링크 복사
                  </button>
                  <button className="btn-danger" style={{ flex: 1, minWidth: "60px", fontSize: "0.75rem", padding: "7px", justifyContent: "center" }}
                    onClick={(e) => { e.stopPropagation(); if (confirm("이 여행을 삭제할까요?")) removeTrip({ tripId: trip._id }); }}>
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        );
      })()}

      {/* 여행 만들기 / 수정 모달 */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontWeight: 700, fontSize: "1.2rem", marginBottom: 24 }}>{editingTripId ? "✏️ 여행 수정" : "✈️ 새 여행 만들기"}</h2>
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label>커버 이모지</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => setForm(f => ({ ...f, coverEmoji: e }))}
                      style={{ fontSize: 24, padding: 8, borderRadius: 8, border: `2px solid ${form.coverEmoji === e ? "var(--accent)" : "transparent"}`, background: form.coverEmoji === e ? "var(--accent-dim)" : "transparent", cursor: "pointer", transition: "all 0.15s" }}>
                        {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label>대시보드 테마 색상</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: "160px", overflowY: "auto", paddingRight: 6 }}>
                  {THEME_COLORS.map(c => (
                    <button key={c.bg} type="button" onClick={() => setForm(f => ({ ...f, themeColor: c.bg }))}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", borderRadius: 8,
                        border: `2px solid ${form.themeColor === c.bg ? "var(--accent)" : "rgba(0,0,0,0.06)"}`,
                        background: form.themeColor === c.bg ? "rgba(99,102,241,0.05)" : "#f8fafc",
                        cursor: "pointer", transition: "all 0.15s"
                      }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: c.bg, flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textAlign: "left", flex: 1 }}>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label>여행 테마</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Friends Trip", "Family Trip", "Couple Trip", "Solo Trip"].map(type => (
                    <button key={type} type="button" onClick={() => setForm(f => ({ ...f, tripType: type }))}
                      style={{
                        padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 600,
                        border: `2px solid ${form.tripType === type ? "var(--accent)" : "rgba(0,0,0,0.08)"}`,
                        background: form.tripType === type ? "rgba(99,102,241,0.05)" : "#ffffff",
                        color: form.tripType === type ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer", transition: "all 0.15s"
                      }}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div><label>여행 이름 *</label><input className="input" placeholder="예: 오사카 봄 여행" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
              <div><label>여행지 *</label><input className="input" placeholder="예: 일본 오사카" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} required /></div>
              <div className="grid-2">
                <div><label>시작일 *</label><input className="input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required /></div>
                <div><label>종료일 *</label><input className="input" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required /></div>
              </div>
              <div>
                <label>주요 통화</label>
                <select className="select" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowForm(false)}>취소</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={saving}>
                  {saving ? <span className="spinner" /> : editingTripId ? "저장" : "만들기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



    </div>
  );
}
