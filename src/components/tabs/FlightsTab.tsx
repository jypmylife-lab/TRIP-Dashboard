"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { analyzeImage } from "@/components/ImageUploader";

const EMPTY_FORM = { airline: "", flightNumber: "", departure: "", arrival: "", departureTime: "", arrivalTime: "", date: "", type: "outbound", notes: "" };

export default function FlightsTab({ trip, nickname }: { trip: any; nickname: string }) {
  const flights = useQuery(api.flights.listByTrip, { tripId: trip._id });
  const addFlight = useMutation(api.flights.add);
  const updateFlight = useMutation(api.flights.update);
  const removeFlight = useMutation(api.flights.remove);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [preview, setPreview] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  async function handleAnalyze(file: File) {
    setAnalyzing(true); setAnalyzeError("");
    try {
      const data = await analyzeImage(file, "flight");
      const flightArray = Array.isArray(data) ? data : [data];
      
      for (const flight of flightArray) {
        await addFlight({ 
          tripId: trip._id,
          airline: flight.airline || "",
          flightNumber: flight.flightNumber || "",
          departure: flight.departure || "",
          arrival: flight.arrival || "",
          departureTime: flight.departureTime || "",
          arrivalTime: flight.arrivalTime || "",
          date: flight.date || "",
          type: flight.type === "return" ? "return" : "outbound",
          notes: ""
        });
      }
      
      setShowForm(false);
      setPreview("");
      setUploadedFile(null);
      setForm({ ...EMPTY_FORM });
    } catch (e: any) { setAnalyzeError(e.message); }
    finally { setAnalyzing(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    if (editingId) {
      await updateFlight({ flightId: editingId as any, ...form });
    } else {
      await addFlight({ tripId: trip._id, ...form });
    }
    setSaving(false); setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); setPreview("");
  }

  function handleEdit(f: any) {
    setForm({ airline: f.airline || "", flightNumber: f.flightNumber || "", departure: f.departure || "", arrival: f.arrival || "", departureTime: f.departureTime || "", arrivalTime: f.arrivalTime || "", date: f.date || "", type: f.type || "outbound", notes: f.notes || "" });
    setEditingId(f._id);
    setShowForm(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.1rem" }}>✈️ 항공편</h2>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ 항공편 추가</button>
      </div>

      {flights === undefined ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" style={{ margin: "0 auto" }} /></div>
        : flights.length === 0 ? (
          <div className="glass" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✈️</div>
            <p>아직 등록된 항공편이 없습니다</p>
            <p style={{ fontSize: "0.8rem", marginTop: 6 }}>항공권 이미지를 업로드하면 AI가 자동으로 분석해줍니다</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {flights.map(f => {
              const isReturn = f.type === "return";
              return (
              <div key={f._id} className="glass glass-hover" style={{
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)",
                cursor: "pointer",
                overflow: "hidden"
              }}
              onClick={() => handleEdit(f)}>
                {/* 티켓 상단 컬러 바 */}
                <div style={{ 
                  background: isReturn ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                  padding: "10px 24px",
                  display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <span style={{ color: "#fff", fontSize: "0.72rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
                    {isReturn ? "🛬 귀국편" : "🛫 출국편"}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.72rem" }}>
                    {f.airline} · {f.flightNumber}
                  </span>
                </div>

                {/* 티켓 본문 */}
                <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  {/* 출발 */}
                  <div style={{ flex: 1, minWidth: 80, textAlign: "center" }}>
                    <div style={{ fontSize: "clamp(1.1rem, 3vw, 1.4rem)", fontWeight: 800, lineHeight: 1.3, color: "var(--text-primary)", wordBreak: "keep-all" }}>
                      {f.departure}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>출발</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)", marginTop: 2 }}>
                      {f.departureTime}
                    </div>
                  </div>

                  {/* 화살표 */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingBottom: 16 }}>
                    <div style={{ width: 60, height: 1, background: "rgba(0,0,0,0.12)", position: "relative" }}>
                      <div style={{ position: "absolute", right: -4, top: -4, fontSize: 10, color: "var(--text-muted)" }}>▶</div>
                    </div>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{f.date}</span>
                  </div>

                  {/* 도착 */}
                  <div style={{ flex: 1, minWidth: 80, textAlign: "center" }}>
                    <div style={{ fontSize: "clamp(1.1rem, 3vw, 1.4rem)", fontWeight: 800, lineHeight: 1.3, color: "var(--text-primary)", wordBreak: "keep-all" }}>
                      {f.arrival}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>도착</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-secondary)", marginTop: 2 }}>
                      {f.arrivalTime}
                    </div>
                  </div>

                  {/* 삭제 버튼 */}
                  <button style={{ padding: "6px 10px", fontSize: "0.75rem", color: "var(--danger)", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6 }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(239,68,68,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}
                    onClick={(e) => { e.stopPropagation(); removeFlight({ flightId: f._id }); }}>
                    삭제
                  </button>
                </div>

                {f.notes && (
                  <div style={{ padding: "8px 24px 14px", borderTop: "1px dashed rgba(0,0,0,0.06)" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>📝 {f.notes}</span>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); setPreview(""); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 20 }}>{editingId ? "✏️ 항공편 수정" : "✈️ 항공편 추가"}</h3>
            {/* 이미지 업로드 */}
            <div style={{ marginBottom: 20 }}>
              <label>항공권 이미지 업로드 (선택)</label>
              <div className={`dropzone ${analyzing ? "drag-over" : ""}`} style={{ padding: 24 }}
                onClick={() => document.getElementById("flight-img")?.click()}>
                {preview
                  ? <img src={preview} alt="preview" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
                  : <div><div style={{ fontSize: 28, marginBottom: 6 }}>📎</div><p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>항공권/탑승권 이미지를 올려주세요</p></div>}
                <input id="flight-img" type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setUploadedFile(f); setPreview(URL.createObjectURL(f)); }}} />
              </div>
              {preview && (
                <button className="btn-primary" style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                  onClick={() => uploadedFile && handleAnalyze(uploadedFile)} disabled={analyzing}>
                  {analyzing ? <><span className="spinner" /> AI 분석 중...</> : "🤖 AI로 자동 분석"}
                </button>
              )}
              {analyzeError && <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: 6 }}>{analyzeError}</p>}
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <div><label>항공사</label><input className="input" placeholder="예: 대한항공" value={form.airline} onChange={e => setForm(f => ({ ...f, airline: e.target.value }))} /></div>
                <div><label>편명</label><input className="input" placeholder="예: KE789" value={form.flightNumber} onChange={e => setForm(f => ({ ...f, flightNumber: e.target.value }))} /></div>
              </div>
              <div className="grid-2">
                <div><label>출발지 *</label><input className="input" placeholder="예: ICN" value={form.departure} onChange={e => setForm(f => ({ ...f, departure: e.target.value }))} required /></div>
                <div><label>도착지 *</label><input className="input" placeholder="예: KIX" value={form.arrival} onChange={e => setForm(f => ({ ...f, arrival: e.target.value }))} required /></div>
              </div>
              <div className="grid-2">
                <div><label>출발 시간</label><input className="input" type="time" value={form.departureTime} onChange={e => setForm(f => ({ ...f, departureTime: e.target.value }))} /></div>
                <div><label>도착 시간</label><input className="input" type="time" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} /></div>
              </div>
              <div className="grid-2">
                <div><label>날짜</label><input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><label>구분</label>
                  <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="outbound">출발편</option><option value="return">귀국편</option>
                  </select>
                </div>
              </div>
              <div><label>메모</label><input className="input" placeholder="메모 (선택)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowForm(false)}>취소</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={saving}>
                  {saving ? <span className="spinner" /> : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
