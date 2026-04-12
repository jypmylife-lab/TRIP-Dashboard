"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { analyzeImage } from "@/components/ImageUploader";

const EMPTY = { name: "", address: "", phone: "", checkIn: "", checkOut: "", confirmationNumber: "", notes: "" };

export default function AccommodationsTab({ trip, nickname }: { trip: any; nickname: string }) {
  const items = useQuery(api.accommodations.listByTrip, { tripId: trip._id });
  const addItem = useMutation(api.accommodations.add);
  const updateItem = useMutation(api.accommodations.update);
  const removeItem = useMutation(api.accommodations.remove);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [preview, setPreview] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  async function handleAnalyze(file: File) {
    setAnalyzing(true); setAnalyzeError("");
    try {
      const data = await analyzeImage(file, "accommodation");
      setForm(f => ({ ...f, ...data }));
    } catch (e: any) { setAnalyzeError(e.message); }
    finally { setAnalyzing(false); }
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    
    let lat: number | undefined;
    let lng: number | undefined;

    if (apiKey && form.name) {
      try {
        const query = encodeURIComponent(`${form.name} ${form.address || trip.destination}`);
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          lat = data.results[0].geometry.location.lat;
          lng = data.results[0].geometry.location.lng;
        }
      } catch (err) {
        console.warn("Accommodation geocode failed", err);
      }
    }

    if (editingId) {
      await updateItem({ accommodationId: editingId as any, ...form, lat, lng });
    } else {
      await addItem({ tripId: trip._id, ...form, lat, lng });
    }
    setSaving(false); setShowForm(false); setEditingId(null); setForm({ ...EMPTY }); setPreview("");
  }

  function handleEdit(item: any) {
    setForm({ name: item.name || "", address: item.address || "", phone: item.phone || "", checkIn: item.checkIn || "", checkOut: item.checkOut || "", confirmationNumber: item.confirmationNumber || "", notes: item.notes || "" });
    setEditingId(item._id);
    setShowForm(true);
  }

  function nights(ci: string, co: string) {
    if (!ci || !co) return "";
    const diff = (new Date(co).getTime() - new Date(ci).getTime()) / 86400000;
    return diff > 0 ? `${diff}박` : "";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.1rem" }}>🏨 숙소</h2>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ 숙소 추가</button>
      </div>

      {items === undefined ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" style={{ margin: "0 auto" }} /></div>
        : items.length === 0 ? (
          <div className="glass" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏨</div>
            <p>아직 등록된 숙소가 없습니다</p>
            <p style={{ fontSize: "0.8rem", marginTop: 6 }}>예약 확인서 이미지를 업로드하면 AI가 자동으로 분석해줍니다</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map(item => (
              <div key={item._id} className="glass glass-hover" style={{ 
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)",
                cursor: "pointer",
                overflow: "hidden"
              }}
              onClick={() => handleEdit(item)}>
                {/* 호텔 헤더 바 */}
                <div style={{ 
                  background: "linear-gradient(135deg, #d97706, #b45309)",
                  padding: "10px 24px",
                  display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <span style={{ color: "#fff", fontSize: "0.72rem", fontWeight: 700, letterSpacing: 3 }}>🏨 HOTEL</span>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.72rem" }}>
                    {nights(item.checkIn, item.checkOut) && `${nights(item.checkIn, item.checkOut)} 숙박`}
                  </span>
                </div>

                {/* 호텔 본문 */}
                <div style={{ padding: "18px 24px", display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: 8, color: "var(--text-primary)" }}>{item.name}</div>
                    {item.address && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 1 }}>📍</span>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{item.address}</span>
                      </div>
                    )}
                    {item.phone && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>📞</span>
                        <a href={`tel:${item.phone}`} onClick={e => e.stopPropagation()}
                          style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
                          {item.phone}
                        </a>
                      </div>
                    )}
                    {item.confirmationNumber && (
                      <div style={{ marginTop: 8, display: "inline-block", background: "rgba(245,158,11,0.1)", color: "#b45309", padding: "2px 10px", borderRadius: 4, fontSize: "0.78rem", fontWeight: 700 }}>
                        예약번호: {item.confirmationNumber}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "right", minWidth: 140 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 2 }}>체크인</div>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: 8 }}>{item.checkIn}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 2 }}>체크아웃</div>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>{item.checkOut}</div>
                  </div>

                  <button style={{ padding: "6px 10px", fontSize: "0.75rem", color: "var(--danger)", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6, alignSelf: "flex-start" }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(239,68,68,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}
                    onClick={(e) => { e.stopPropagation(); removeItem({ accommodationId: item._id }); }}>삭제</button>
                </div>

                {item.notes && (
                  <div style={{ padding: "8px 24px 14px", borderTop: "1px dashed rgba(0,0,0,0.06)" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>📝 {item.notes}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY }); setPreview(""); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 20 }}>{editingId ? "✏️ 숙소 수정" : "🏨 숙소 추가"}</h3>
            <div style={{ marginBottom: 20 }}>
              <label>예약 확인서 이미지 (선택)</label>
              <div className={`dropzone ${analyzing ? "drag-over" : ""}`} style={{ padding: 24 }}
                onClick={() => document.getElementById("hotel-img")?.click()}>
                {preview
                  ? <img src={preview} alt="preview" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
                  : <div><div style={{ fontSize: 28, marginBottom: 6 }}>📎</div><p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>예약 확인서 / 바우처 이미지를 올려주세요</p></div>}
                <input id="hotel-img" type="file" accept="image/*" style={{ display: "none" }}
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
              <div><label>숙소 이름 *</label><input className="input" placeholder="예: 더 리츠-칼튼 오사카" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div><label>주소</label><input className="input" placeholder="주소 (지도 핀 자동 등록)" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><label>전화번호</label><input className="input" placeholder="예: +81-6-1234-5678" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="grid-2">
                <div><label>체크인</label><input className="input" type="date" value={form.checkIn} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} /></div>
                <div><label>체크아웃</label><input className="input" type="date" value={form.checkOut} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} /></div>
              </div>
              <div><label>예약 번호</label><input className="input" placeholder="예약 번호 또는 확인 코드" value={form.confirmationNumber} onChange={e => setForm(f => ({ ...f, confirmationNumber: e.target.value }))} /></div>
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
