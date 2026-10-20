"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// 탭 타이틀 옆에 붙는 작은 닉네임 뱃지: 평소엔 내 닉네임만 보이고, 누르면 전체 참여자 목록 + 변경 버튼이 펼쳐짐
export default function NicknameBadge({ trip, nickname, shareId }: { trip: any; nickname: string; shareId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const participants = useQuery(api.participants.listByTrip, trip ? { tripId: trip._id } : "skip");
  const removeParticipant = useMutation(api.participants.remove);

  useEffect(() => {
    if (localStorage.getItem("adminToken")) setIsAdmin(true);
  }, []);

  function handleChangeNickname() {
    localStorage.removeItem(`nickname_${shareId}`);
    window.location.reload();
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setExpanded(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 10px", borderRadius: 999, fontSize: "0.72rem", fontWeight: 800, background: "rgba(0,0,0,0.06)", color: "var(--text-secondary)", border: "none", cursor: "pointer" }}>
        👤 {nickname} <span style={{ fontSize: "0.6rem" }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <>
          <div onClick={() => setExpanded(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50, background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", padding: 10, minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {participants?.map((p: any) => {
                const isMe = p.nickname === nickname;
                return (
                  <div key={p._id} style={{ display: "flex", alignItems: "center", gap: 4, background: isMe ? "var(--accent-dim)" : "rgba(0,0,0,0.05)", color: isMe ? "var(--accent)" : "var(--text-secondary)", padding: "4px 10px", fontSize: "0.74rem", fontWeight: 800, borderRadius: 999, whiteSpace: "nowrap" }}>
                    <span>{p.nickname}</span>
                    {isAdmin && (
                      <button onClick={() => { if (confirm(`'${p.nickname}' 참가자를 삭제하시겠습니까?`)) removeParticipant({ participantId: p._id }); }}
                        style={{ background: "transparent", border: "none", opacity: 0.5, cursor: "pointer", fontSize: "0.68rem", fontWeight: 900, color: "inherit" }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={handleChangeNickname}
              style={{ alignSelf: "flex-end", padding: "4px 12px", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 999, background: "transparent", cursor: "pointer" }}>
              변경
            </button>
          </div>
        </>
      )}
    </div>
  );
}
