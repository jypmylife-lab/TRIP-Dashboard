"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { analyzeImage } from "@/components/ImageUploader";

const CATEGORIES = [
  { id: "food", label: "식비", emoji: "🍱" },
  { id: "transport", label: "교통", emoji: "🚕" },
  { id: "accommodation", label: "숙박", emoji: "🏨" },
  { id: "activity", label: "액티비티", emoji: "🎫" },
  { id: "other", label: "기타", emoji: "🛒" },
];

export default function ExpensesTab({ trip, nickname }: { trip: any; nickname: string }) {
  const expenses = useQuery(api.expenses.listByTrip, { tripId: trip._id });
  const participantsList = useQuery(api.participants.listByTrip, { tripId: trip._id });
  const addExpense = useMutation(api.expenses.add);
  const updateExpense = useMutation(api.expenses.update);
  const removeExpense = useMutation(api.expenses.remove);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // 폼 상태
  const [form, setForm] = useState({
    title: "", amount: "", category: "food", date: "",
    paidBy: nickname, splitWith: [] as string[], exchangeRate: ""
  });
  const [useCustomRate, setCustomRate] = useState(false);
  const [currencyInfo, setCurrencyInfo] = useState({ rate: 1, isFallback: false });
  
  // AI 연동 상태
  const [preview, setPreview] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // 환율 정보 가져오기
  useEffect(() => {
    async function fetchRate() {
      try {
        const res = await fetch(`/api/exchange-rate?base=${trip.currency || "USD"}`);
        const data = await res.json();
        if (data.ok) {
          setCurrencyInfo({ rate: data.rate, isFallback: data.isFallback });
          if (!useCustomRate) setForm(f => ({ ...f, exchangeRate: data.rate.toString() }));
        }
      } catch (e) {
        console.error("환율 로드 오류:", e);
      }
    }
    fetchRate();
  }, [trip.currency, useCustomRate]);
  
  // 첫 진입시 모든 참가자 기본 선택 (자신 포함)
  useEffect(() => {
    if (participantsList && form.splitWith.length === 0) {
      setForm(f => ({ ...f, splitWith: participantsList.map(p => p.nickname) }));
    }
  }, [participantsList]);

  async function handleAnalyze(file: File) {
    setAnalyzing(true); setAnalyzeError("");
    try {
      const data = await analyzeImage(file, "expense");
      const expensesArray = Array.isArray(data) ? data : [data];
      
      const currentRate = currencyInfo.rate || 1;

      for (const item of expensesArray) {
        const amt = parseFloat(item.amount) || 0;
        await addExpense({
          tripId: trip._id,
          title: item.title || "영수증 항목",
          amount: amt,
          currency: item.currency || trip.currency || "USD",
          exchangeRate: currentRate,
          amountKRW: Math.round(amt * currentRate),
          date: item.date || new Date().toISOString().split("T")[0],
          paidBy: nickname,
          splitWith: form.splitWith.length > 0 ? form.splitWith : [nickname],
          category: item.category || "other",
        });
      }

      setShowForm(false);
      setPreview("");
      setUploadedFile(null);
      setForm({ title: "", amount: "", category: "food", date: "", paidBy: nickname, splitWith: form.splitWith, exchangeRate: "" });
    } catch (e: any) { setAnalyzeError(e.message); }
    finally { setAnalyzing(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.splitWith.length === 0) {
      alert("지출을 나눌 참가자를 최소 1명 이상 선택해주세요.");
      return;
    }
    
    setSaving(true);
    const amountNum = parseFloat(form.amount) || 0;
    const rateNum = parseFloat(form.exchangeRate) || 1;
    
    const payload = {
      title: form.title,
      amount: amountNum,
      currency: trip.currency || "USD",
      exchangeRate: rateNum,
      amountKRW: amountNum * rateNum,
      date: form.date,
      paidBy: form.paidBy,
      splitWith: form.splitWith,
      category: form.category
    };

    if (editingId) {
      await updateExpense({ expenseId: editingId as any, ...payload });
    } else {
      await addExpense({ tripId: trip._id, ...payload });
    }
    
    setSaving(false); setShowForm(false); setEditingId(null);
    setForm({ ...form, title: "", amount: "", date: "" }); setPreview("");
  }

  function handleEdit(e: any) {
    setForm({
      title: e.title || "", amount: e.amount.toString() || "", category: e.category || "food", date: e.date || "",
      paidBy: e.paidBy || nickname, splitWith: e.splitWith || [], exchangeRate: e.exchangeRate.toString() || ""
    });
    setEditingId(e._id);
    setShowForm(true);
  }
  
  // 정산 알고리즘 (최소 송금 횟수 계산)
  function calculateSettlement() {
    if (!expenses) return [];
    
    const balances: Record<string, number> = {};
    
    // 잔액 계산: 내가 결제한 돈(받아야 할 돈 +) vs 내가 내야 할 돈(갚아야 할 돈 -) (KRW 기준)
    expenses.forEach(exp => {
      // 결제자
      balances[exp.paidBy] = (balances[exp.paidBy] || 0) + exp.amountKRW;
      
      // 분담자 (N빵)
      const splitKrw = exp.amountKRW / exp.splitWith.length;
      exp.splitWith.forEach(person => {
        balances[person] = (balances[person] || 0) - splitKrw;
      });
    });
    
    // - 인 사람(채무자)과 + 인 사람(채권자) 분리
    const debtors: { name: string; amount: number }[] = [];
    const creditors: { name: string; amount: number }[] = [];
    
    Object.entries(balances).forEach(([name, amount]) => {
      if (amount < -1) debtors.push({ name, amount: -amount });
      else if (amount > 1) creditors.push({ name, amount });
    });
    
    // 큰 금액부터 정렬
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    
    const settlements: { from: string; to: string; amount: number }[] = [];
    
    let dIdx = 0, cIdx = 0;
    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      
      const amount = Math.min(debtor.amount, creditor.amount);
      
      debtor.amount -= amount;
      creditor.amount -= amount;
      
      // 10원 단위 반올림
      settlements.push({ 
        from: debtor.name, 
        to: creditor.name, 
        amount: Math.round(amount / 10) * 10 
      });
      
      if (debtor.amount < 1) dIdx++;
      if (creditor.amount < 1) cIdx++;
    }
    
    return settlements;
  }

  const settlements = calculateSettlement();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: "1.1rem" }}>💸 지출 및 정산</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 4 }}>기준 통화: {trip.currency || "USD"}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ 지출 추가</button>
      </div>

      {/* 최종 정산 요약 - 지출이 있을 때만 표시 */}
      {expenses && expenses.length > 0 && settlements.length > 0 && (
        <div className="glass" style={{ padding: 20, border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.04)" }}>
          <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <span>📊</span> 최종 정산 결과
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {settlements.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.1)", paddingBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{s.from}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>→</span>
                  <span style={{ fontWeight: 600 }}>{s.to}</span>
                </div>
                <div style={{ fontWeight: 700, color: "var(--accent)" }}>
                  {s.amount.toLocaleString()}원 보내기
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 지출 목록 */}
      {expenses === undefined ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" style={{ margin: "0 auto" }} /></div>
        : expenses.length === 0 ? (
          <div className="glass" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
            <p>등록된 지출이 없습니다</p>
            <p style={{ fontSize: "0.8rem", marginTop: 6 }}>결제 영수증 등 지출을 추가하고 함께 정산하세요</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-secondary)" }}>상세 지출 내역</h3>
            {expenses.map(e => {
              const cat = CATEGORIES.find(c => c.id === e.category);
              return (
                <div key={e._id} className="glass glass-hover" style={{ 
                  background: "#ffffff",
                  padding: "20px 24px", 
                  display: "flex", 
                  gap: 16,
                  alignItems: "center",
                  borderRadius: "12px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
                  cursor: "pointer"
                }}
                onClick={() => handleEdit(e)}>
                  <div style={{ fontSize: 32 }}>{cat?.emoji || "🛒"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>{e.title}</span>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{e.amount.toLocaleString()} {e.currency}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>≈ ₩{Math.round(e.amountKRW).toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <span style={{ background: "rgba(0,0,0,0.03)", padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600 }}>{e.date}</span>
                      <span style={{ background: "rgba(16,185,129,0.1)", color: "var(--success)", padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 700 }}>결제: {e.paidBy}</span>
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                      참여: {e.splitWith.join(", ")} <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: 8 }}>(인당 ₩{Math.round(e.amountKRW / Math.max(1, e.splitWith.length)).toLocaleString()})</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: "0.78rem", color: "var(--danger)", background: "transparent" }} 
                      onMouseEnter={e => e.currentTarget.style.background="rgba(239, 68, 68, 0.1)"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}
                      onClick={(evt) => { evt.stopPropagation(); removeExpense({ expenseId: e._id }); }}>삭제</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* 모달 폼 */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingId(null); setPreview(""); }}>
          <div className="modal" onClick={evt => evt.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 20 }}>{editingId ? "✏️ 지출 수정" : "💸 지출 추가"}</h3>
            
            {/* 영수증 업로드 */}
            <div style={{ marginBottom: 20 }}>
              <label>영수증/캡처 이미지 (선택)</label>
              <div className={`dropzone ${analyzing ? "drag-over" : ""}`} style={{ padding: 24 }}
                onClick={() => document.getElementById("expense-img")?.click()}>
                {preview
                  ? <img src={preview} alt="preview" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
                  : <div><div style={{ fontSize: 28, marginBottom: 6 }}>🧾</div><p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>영수증 이미지를 올려주세요</p></div>}
                <input id="expense-img" type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setUploadedFile(f); setPreview(URL.createObjectURL(f)); }}} />
              </div>
              {preview && (
                <button className="btn-primary" style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                  onClick={() => uploadedFile && handleAnalyze(uploadedFile)} disabled={analyzing}>
                  {analyzing ? <><span className="spinner" /> AI 영수증 텍스트 추출 중...</> : "🤖 AI 영수증 분석"}
                </button>
              )}
              {analyzeError && <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: 6 }}>{analyzeError}</p>}
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label>항목 이름 *</label><input className="input" placeholder="예: 스시 저녁" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
              
              <div className="grid-2">
                <div>
                  <label>금액 ({trip.currency}) *</label>
                  <input className="input" type="number" step="any" placeholder="결제 금액" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div>
                  <label>
                    <span style={{flex: 1}}>적용 환율 </span>
                    <button type="button" onClick={() => setCustomRate(!useCustomRate)} style={{background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.7rem', cursor: 'pointer', float: 'right'}}>
                      {useCustomRate ? "자동 환율 사용" : "수동 입력"}
                    </button>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input className="input" type="number" step="any" placeholder={`${trip.currency} -> KRW 환율`} value={form.exchangeRate} onChange={e => setForm(f => ({ ...f, exchangeRate: e.target.value }))} disabled={!useCustomRate} style={{ background: !useCustomRate ? "rgba(255,255,255,0.02)" : undefined }} required />
                    {!useCustomRate && currencyInfo.isFallback && <p style={{ color: "var(--warning)", fontSize: "0.65rem", marginTop: 4 }}>*API 키 없음. 참고 환율이 적용됨.</p>}
                  </div>
                </div>
              </div>

              <div>
                <label>예상 한화 환산 금액</label>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: 10, padding: "10px 14px", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                  ≈ ₩{Math.round((parseFloat(form.amount) || 0) * (parseFloat(form.exchangeRate) || 1)).toLocaleString()}
                </div>
              </div>

              <div className="grid-2">
                <div><label>결제 일자</label><input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div>
                  <label>카테고리</label>
                  <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="divider" style={{ margin: "10px 0" }} />

              <div className="grid-2" style={{ alignItems: "flex-start" }}>
                <div>
                  <label>💳 결제한 사람</label>
                  <select className="select" value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))}>
                    <option value={nickname}>{nickname} (나)</option>
                    {participantsList?.filter(p => p.nickname !== nickname).map(p => (
                      <option key={p._id} value={p.nickname}>{p.nickname}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>👥 함께 나눌 사람 (N빵)</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {participantsList?.map(p => (
                      <label key={p._id} style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: "0.85rem", cursor: "pointer", color: "var(--text-primary)" }}>
                        <input type="checkbox" style={{ accentColor: "var(--accent)" }}
                          checked={form.splitWith.includes(p.nickname)}
                          onChange={e => {
                            if (e.target.checked) setForm(f => ({ ...f, splitWith: [...f.splitWith, p.nickname] }));
                            else setForm(f => ({ ...f, splitWith: f.splitWith.filter(name => name !== p.nickname) }));
                          }}
                        />
                        {p.nickname} {p.nickname === nickname && "(나)"}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
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
