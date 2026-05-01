"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function ChecklistTab({ trip, nickname }: { trip: any; nickname: string }) {
  const items = useQuery(api.places.listChecklistsByTrip, { tripId: trip._id });
  const participants = useQuery(api.participants.listByTrip, { tripId: trip._id });
  const addItem = useMutation(api.places.addChecklist);
  const updateItem = useMutation(api.places.updateChecklist);
  const toggleItem = useMutation(api.places.toggleChecklist);
  const toggleAssigneeCheck = useMutation(api.places.toggleAssignee);
  const removeItem = useMutation(api.places.removeChecklist);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editAssignees, setEditAssignees] = useState<string[]>([]);

  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [addingDefaults, setAddingDefaults] = useState(false);

  // 닉네임 목록 (등록된 참가자 + 현재 사용자)
  const nicknames = participants
    ? [...new Set([nickname, ...participants.map(p => p.nickname)])]
    : [nickname];

  // 기본 준비물 목록
  const DEFAULT_ITEMS = [
    "여권", "환전, 해외 신용카드", "항공권 티켓", "여행자보험", "유심",
    "세안용품", "기초화장품", "샤워용품", "비상약", "충전기", "변환플러그", "옷", "속옷",
  ];

  async function handleAddDefaults() {
    setAddingDefaults(true);
    const existingTexts = new Set((items || []).map(i => i.text));
    for (const text of DEFAULT_ITEMS) {
      if (!existingTexts.has(text)) {
        // 담당자를 '모두'로 설정
        await addItem({ tripId: trip._id, text, assignees: nicknames });
      }
    }
    setAddingDefaults(false);
  }

  // 자동 생성 로직
  useEffect(() => {
    const autoKey = `checklist_auto_added_${trip._id}`;
    if (items !== undefined && items.length === 0 && !addingDefaults && !localStorage.getItem(autoKey)) {
      localStorage.setItem(autoKey, "true");
      handleAddDefaults();
    }
  }, [items, addingDefaults, trip._id, nicknames]);

  function toggleAssignee(name: string, list: string[], setList: (l: string[]) => void) {
    setList(list.includes(name) ? list.filter(n => n !== name) : [...list, name]);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    await addItem({
      tripId: trip._id,
      text: text.trim(),
      link: link.trim() || undefined,
      assignees: selectedAssignees.length > 0 ? selectedAssignees : undefined,
    });
    setSaving(false);
    setText("");
    setLink("");
    setSelectedAssignees([]);
  }

  async function handleSaveEdit(id: string) {
    if (!editText.trim()) return;
    await updateItem({
      checklistId: id as any,
      text: editText.trim(),
      link: editLink.trim() || undefined,
      assignees: editAssignees,
    });
    setEditingId(null);
  }

  function startEdit(item: any) {
    setEditingId(item._id);
    setEditText(item.text);
    setEditLink(item.link || "");
    // 기존 assignees 우선, 없으면 assignee(단일) 하위호환
    setEditAssignees(item.assignees ?? (item.assignee ? [item.assignee] : []));
  }

  const done = items?.filter(i => i.completed).length || 0;
  const total = items?.length || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.1rem" }}>📋 체크리스트</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {total > 0 && <span className={`badge ${pct === 100 ? "badge-green" : "badge-purple"}`}>{done}/{total} 완료</span>}
        </div>
      </div>

      {/* 진행률 바 */}
      {total > 0 && (
        <div style={{ background: "rgba(0,0,0,0.05)", borderRadius: 99, height: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--success)" : "var(--accent)", borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
      )}

      {/* 추가 폼 */}
      <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input className="input" style={{ flex: 1 }} placeholder="예: 여권 챙기기, 환전하기..." value={text} onChange={e => setText(e.target.value)} />
          <button className="btn-primary" type="submit" disabled={saving} style={{ whiteSpace: "nowrap" }}>
            {saving ? <span className="spinner" /> : "추가"}
          </button>
        </div>
        <input className="input" style={{ fontSize: "0.85rem", padding: "8px 12px" }} placeholder="🔗 참고 링크 (선택, http://...)" value={link} onChange={e => setLink(e.target.value)} />
        {/* 담당자 선택 */}
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>담당자 선택 (복수 선택 가능)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button"
              onClick={() => setSelectedAssignees(selectedAssignees.length === nicknames.length ? [] : [...nicknames])}
              style={{
                padding: "4px 12px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 700,
                border: "1px solid", cursor: "pointer", transition: "all 0.15s",
                background: selectedAssignees.length === nicknames.length ? "var(--accent)" : "transparent",
                color: selectedAssignees.length === nicknames.length ? "#fff" : "var(--accent)",
                borderColor: "var(--accent)",
              }}>
              ✨ 모두
            </button>
            {nicknames.map(name => (
              <button key={name} type="button"
                onClick={() => toggleAssignee(name, selectedAssignees, setSelectedAssignees)}
                style={{
                  padding: "4px 12px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600,
                  border: "1px solid",
                  cursor: "pointer", transition: "all 0.15s",
                  background: selectedAssignees.includes(name) ? "var(--accent)" : "transparent",
                  color: selectedAssignees.includes(name) ? "#fff" : "var(--text-secondary)",
                  borderColor: selectedAssignees.includes(name) ? "var(--accent)" : "rgba(0,0,0,0.12)",
                }}>
                👤 {name}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* 목록 */}
      {items === undefined ? (
        <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" style={{ margin: "0 auto" }} /></div>
      ) : items.length === 0 ? (
        <div className="glass" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p>아직 체크리스트가 없습니다</p>
          <p style={{ fontSize: "0.8rem", marginTop: 6 }}>여행 준비물이나 할 일을 추가해보세요!</p>
          {addingDefaults && (
            <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", background: "rgba(0,0,0,0.04)", borderRadius: 12 }}>
              <span className="spinner" /> 기본 준비물 추가 중...
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...items].sort((a, b) => Number(a.completed) - Number(b.completed)).map(item => {
            const assigneesDisplay = item.assignees ?? (item.assignee ? [item.assignee] : []);
            return (
              <div key={item._id} className="glass glass-hover" style={{
                background: "#ffffff",
                padding: "14px 18px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                opacity: item.completed ? 0.55 : 1,
                transition: "all 0.2s",
                border: "1px solid rgba(0,0,0,0.05)",
                borderRadius: "12px",
                boxShadow: "0 2px 4px -2px rgba(0,0,0,0.03)"
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (assigneesDisplay.length > 0) {
                      // 담당자가 있을 경우, 현재 접속자의 닉네임이 리스트에 있으면 그 사람만 체크 토글
                      if (assigneesDisplay.includes(nickname)) {
                        toggleAssigneeCheck({ checklistId: item._id, nickname });
                      }
                      return;
                    }
                    // 담당자가 없을 경우 기존 전체 체크 토글
                    toggleItem({ checklistId: item._id, completed: !item.completed });
                  }}
                  style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 1,
                    border: `2px solid ${item.completed ? "var(--success)" : "rgba(0,0,0,0.15)"}`,
                    background: item.completed ? "rgba(16,185,129,0.1)" : "transparent",
                    cursor: (assigneesDisplay.length > 0 && !assigneesDisplay.includes(nickname)) ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s", fontSize: 14, color: "var(--success)"
                  }}>
                  {item.completed ? "✓" : ""}
                </button>

                {/* 내용 */}
                <div style={{ flex: 1 }} onClick={() => !item.completed && startEdit(item)}>
                  {editingId === item._id ? (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input autoFocus className="input" style={{ padding: "6px 12px", minHeight: "auto" }}
                        value={editText} onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); handleSaveEdit(item._id); } }} />
                      <input className="input" style={{ padding: "6px 12px", minHeight: "auto", fontSize: "0.8rem" }}
                        placeholder="🔗 참고 링크 (선택, http://...)"
                        value={editLink} onChange={e => setEditLink(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); handleSaveEdit(item._id); } }} />
                      {/* 수정 시 담당자 선택 */}
                      <div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>담당자 변경</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <button type="button"
                            onClick={() => setEditAssignees(editAssignees.length === nicknames.length ? [] : [...nicknames])}
                            style={{
                              padding: "3px 10px", borderRadius: 99, fontSize: "0.75rem", fontWeight: 700,
                              border: "1px solid", cursor: "pointer", transition: "all 0.15s",
                              background: editAssignees.length === nicknames.length ? "var(--accent)" : "transparent",
                              color: editAssignees.length === nicknames.length ? "#fff" : "var(--accent)",
                              borderColor: "var(--accent)",
                            }}>
                            ✨ 모두
                          </button>
                          {nicknames.map(name => (
                          <button key={name} type="button"
                            onClick={() => toggleAssignee(name, editAssignees, setEditAssignees)}
                            style={{
                              padding: "3px 10px", borderRadius: 99, fontSize: "0.75rem", fontWeight: 600,
                              border: "1px solid", cursor: "pointer", transition: "all 0.15s",
                              background: editAssignees.includes(name) ? "var(--accent)" : "transparent",
                              color: editAssignees.includes(name) ? "#fff" : "var(--text-secondary)",
                              borderColor: editAssignees.includes(name) ? "var(--accent)" : "rgba(0,0,0,0.12)",
                            }}>
                            👤 {name}
                          </button>
                        ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn-primary" style={{ padding: "5px 14px", fontSize: "0.8rem", height: "auto" }}
                          onClick={(e) => { e.stopPropagation(); handleSaveEdit(item._id); }}>저장</button>
                        <button style={{ padding: "5px 14px", fontSize: "0.8rem", background: "transparent", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, cursor: "pointer", color: "var(--text-secondary)" }}
                          onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ cursor: item.completed ? "default" : "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: "0.95rem", fontWeight: 600,
                          textDecoration: item.completed ? "line-through" : "none",
                          color: item.completed ? "var(--text-muted)" : "var(--text-primary)"
                        }}>
                          {item.text}
                        </span>
                        {item.link && (
                          <a href={item.link.startsWith("http") ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: "0.75rem", background: "rgba(99,102,241,0.1)", color: "var(--accent)",
                              padding: "2px 8px", borderRadius: 99, textDecoration: "none", fontWeight: 600,
                              display: "inline-flex", alignItems: "center", border: "1px solid rgba(99,102,241,0.2)"
                            }}>
                            🔗 링크 보기
                          </a>
                        )}
                      </div>
                      {/* 담당자 표시 */}
                      {assigneesDisplay.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                          {assigneesDisplay.map((name: string) => {
                            const isPersonDone = item.completedBy?.includes(name);
                            return (
                              <button key={name} 
                                onClick={() => toggleAssigneeCheck({ checklistId: item._id, nickname: name })}
                                style={{
                                  fontSize: "0.72rem", color: isPersonDone ? "var(--text-muted)" : "var(--accent)", fontWeight: 700,
                                  background: isPersonDone ? "transparent" : "rgba(99,102,241,0.08)", 
                                  padding: "2px 8px", borderRadius: 99, 
                                  border: `1px solid ${isPersonDone ? "rgba(0,0,0,0.1)" : "rgba(99,102,241,0.15)"}`,
                                  textDecoration: isPersonDone ? "line-through" : "none",
                                  cursor: "pointer", transition: "all 0.15s",
                                  display: "flex", alignItems: "center", gap: 4
                                }}>
                                <span style={{ opacity: isPersonDone ? 0.5 : 1 }}>👤</span> {name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 삭제 */}
                {editingId !== item._id && (
                  <button style={{ padding: "4px 8px", fontSize: "0.75rem", color: "var(--danger)", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6, flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    onClick={() => removeItem({ checklistId: item._id })}>삭제</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
