"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { analyzeImage } from "@/components/ImageUploader";

const EMPTY_FORM = { airline: "", flightNumber: "", departure: "", arrival: "", departureTime: "", arrivalTime: "", date: "", type: "outbound", notes: "", checkInCounter: "" };

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
    setForm({ airline: f.airline || "", flightNumber: f.flightNumber || "", departure: f.departure || "", arrival: f.arrival || "", departureTime: f.departureTime || "", arrivalTime: f.arrivalTime || "", date: f.date || "", type: f.type || "outbound", notes: f.notes || "", checkInCounter: f.checkInCounter || "" });
    setEditingId(f._id);
    setShowForm(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.02em" }}>✈️ 항공편</h2>
        <button className="btn-primary" onClick={() => setShowForm(true)} style={{ padding: "7px 14px", fontSize: "0.78rem", minHeight: "auto" }}>+ 항공편 추가</button>
      </div>

      {flights === undefined ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" style={{ margin: "0 auto" }} /></div>
        : flights.length === 0 ? (
          <div className="glass" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✈️</div>
            <p>아직 등록된 항공편이 없습니다</p>
            <p style={{ fontSize: "0.8rem", marginTop: 6 }}>항공권 이미지를 업로드하면 AI가 자동으로 분석해줍니다</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {flights.map(f => {
              const isReturn = f.type === "return";
              return (
              <div key={f._id} className="glass glass-hover" style={{
                background: "#ffffff",
                borderRadius: 20,
                border: "2px solid rgba(0,0,0,0.08)",
                cursor: "pointer",
                overflow: "hidden"
              }}
              onClick={() => handleEdit(f)}>
                {/* 티켓 상단 컬러 바 */}
                <div style={{ 
                  background: "var(--yellow)",
                  padding: "0 18px",
                  minHeight: 54,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: "2px solid rgba(0,0,0,0.08)"
                }}>
                  <span style={{ color: "#1a1a1a", fontSize: "0.75rem", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
                    {isReturn ? "🛬 귀국편" : "🛫 출국편"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.75rem", fontWeight: 700 }}>
                      {f.airline} · {f.flightNumber}
                    </span>
                    <button
                      style={{ padding: "4px 10px", fontSize: "0.72rem", fontWeight: 700, color: "#1a1a1a", background: "rgba(0,0,0,0.05)", border: "2px solid rgba(0,0,0,0.05)", cursor: "pointer", borderRadius: 999 }}
                      onClick={(e) => { e.stopPropagation(); removeFlight({ flightId: f._id }); }}>
                      삭제
                    </button>
                  </div>
                </div>

                {/* 티켓 본문 */}
                <div style={{ padding: "18px", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginBottom: 2, fontWeight: 600 }}>출발</div>
                    <div style={{ fontSize: "clamp(0.82rem, 2.5vw, 0.95rem)", fontWeight: 800, lineHeight: 1.3, color: "var(--text-primary)", wordBreak: "keep-all" }}>
                      {f.departure}
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--text-primary)", marginTop: 4 }}>
                      {f.departureTime}
                    </div>
                    {f.checkInCounter && (
                      <div style={{ marginTop: 4, fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)", background: "rgba(99,102,241,0.08)", display: "inline-block", padding: "2px 8px", borderRadius: 999 }}>
                        체크인 {f.checkInCounter}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 4px 0" }}>
                    <div style={{ width: 50, height: 2, background: "rgba(0,0,0,0.12)", borderRadius: 1, position: "relative" }}>
                      <div style={{ position: "absolute", right: -5, top: -4, fontSize: 10, color: "var(--text-muted)" }}>▶</div>
                    </div>
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap", background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 999 }}>{f.date}</span>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginBottom: 2, fontWeight: 600 }}>도착</div>
                    <div style={{ fontSize: "clamp(0.82rem, 2.5vw, 0.95rem)", fontWeight: 800, lineHeight: 1.3, color: "var(--text-primary)", wordBreak: "keep-all" }}>
                      {f.arrival}
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--text-secondary)", marginTop: 4 }}>
                      {f.arrivalTime}
                    </div>
                  </div>
                </div>

                {f.notes && (
                  <div style={{ padding: "10px 18px 14px", borderTop: "2px dashed rgba(0,0,0,0.06)" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500 }}>📝 {f.notes}</span>
                  </div>
                )}

                {f.flightNumber && (
                  <FlightGateInfo
                    flightId={f._id}
                    flightNumber={f.flightNumber}
                    departure={f.departure}
                    date={f.date}
                    cachedGateInfo={f.gateInfo}
                    cachedFetchedAt={f.gateInfoFetchedAt}
                  />
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
              <div><label>체크인 카운터</label><input className="input" placeholder="예: D (알고 있다면 입력)" value={form.checkInCounter} onChange={e => setForm(f => ({ ...f, checkInCounter: e.target.value }))} /></div>
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

// 실시간 게이트/터미널 조회 (AviationStack) - 출발 당일에 가까워져야 데이터가 채워짐
// + 인천공항 출발편은 체크인 카운터도 함께 자동 조회 (인천국제공항공사 OpenAPI)
// 외부 API 호출 횟수 제한(월 한도) 때문에 결과를 Convex에 캐싱해서 전 참여자가 공유하고,
// 캐시가 일정 시간 이내면 재호출하지 않음 (새로고침 버튼으로 강제 재조회는 가능)
const GATE_INFO_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

function FlightGateInfo({ flightId, flightNumber, departure, date, cachedGateInfo, cachedFetchedAt }: {
  flightId: any; flightNumber: string; departure?: string; date?: string;
  cachedGateInfo?: any; cachedFetchedAt?: number;
}) {
  const saveGateInfo = useMutation(api.flights.saveGateInfo);
  const isFresh = !!cachedFetchedAt && (Date.now() - cachedFetchedAt < GATE_INFO_TTL_MS);

  const [loading, setLoading] = useState(!isFresh);
  const [result, setResult] = useState<any>(isFresh ? cachedGateInfo : null);
  const [fetchedAt, setFetchedAt] = useState<number | undefined>(isFresh ? cachedFetchedAt : undefined);

  async function handleCheck(e?: React.MouseEvent) {
    e?.stopPropagation();
    setLoading(true);
    const gateInfo: any = {};
    try {
      const res = await fetch(`/api/flight-status?flightNumber=${encodeURIComponent(flightNumber)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "조회 실패");
      gateInfo.flightStatus = data.flightStatus;
      gateInfo.departureTerminal = data.departure?.terminal || undefined;
      gateInfo.departureGate = data.departure?.gate || undefined;
      gateInfo.arrivalTerminal = data.arrival?.terminal || undefined;
      gateInfo.arrivalGate = data.arrival?.gate || undefined;
    } catch (err: any) {
      gateInfo.error = err.message || "조회 중 오류가 발생했습니다.";
    }

    if (departure && /icn|인천/i.test(departure)) {
      try {
        const q = new URLSearchParams({ flightNumber, departure, date: date || "" });
        const res = await fetch(`/api/checkin-counter?${q.toString()}`);
        const data = await res.json();
        if (res.ok) gateInfo.checkInCounterAuto = data.checkInCounter;
      } catch {
        // 체크인 카운터는 보조 정보이므로 실패해도 조용히 무시
      }
    }

    setResult(gateInfo);
    setFetchedAt(Date.now());
    setLoading(false);
    saveGateInfo({ flightId, gateInfo }).catch(() => {});
  }

  useEffect(() => {
    if (!isFresh) handleCheck();
    // 캐시가 신선하면 조회를 건너뛰어 API 호출 횟수를 아낌
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightNumber]);

  const error = result?.error;
  const updatedLabel = (() => {
    if (!fetchedAt) return null;
    const minutes = Math.round((Date.now() - fetchedAt) / 60000);
    if (minutes < 1) return "방금 업데이트";
    if (minutes < 60) return `${minutes}분 전 업데이트`;
    return `${Math.round(minutes / 60)}시간 전 업데이트`;
  })();

  return (
    <div style={{ padding: "10px 18px 14px", borderTop: "2px dashed rgba(0,0,0,0.06)" }} onClick={e => e.stopPropagation()}>
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
          <span className="spinner" style={{ width: 14, height: 14 }} /> 게이트/터미널 조회 중...
        </div>
      )}
      {!loading && error && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: "0.76rem", color: "var(--text-muted)" }}>
          <span>⚠️ {error}</span>
          <button onClick={handleCheck} style={{ flexShrink: 0, fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>다시 시도</button>
        </div>
      )}
      {!loading && result && !error && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: result.checkInCounterAuto ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8 }}>
            <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 2 }}>출발 터미널 · 게이트</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 800 }}>{result.departureTerminal || "-"} · {result.departureGate || "-"}</div>
            </div>
            {result.checkInCounterAuto && (
              <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: "0.66rem", color: "var(--accent)", fontWeight: 700, marginBottom: 2 }}>체크인 카운터</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--accent)" }}>{result.checkInCounterAuto}</div>
              </div>
            )}
            <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 2 }}>도착 터미널 · 게이트</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 800 }}>{result.arrivalTerminal || "-"} · {result.arrivalGate || "-"}</div>
            </div>
          </div>
          {updatedLabel && (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{updatedLabel}</span>
              <button onClick={handleCheck} style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>🔄 새로고침</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
