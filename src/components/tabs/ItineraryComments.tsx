"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function ItineraryComments({ item, photoId, nickname }: { item: any; photoId: string; nickname: string }) {
  const comments = useQuery(api.itinerary.listCommentsByPhoto, { photoId });
  const addComment = useMutation(api.itinerary.addComment);
  const removeComment = useMutation(api.itinerary.removeComment);
  const [text, setText] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await addComment({ itemId: item._id, photoId, tripId: item.tripId, nickname, text: text.trim() });
    setText("");
  }

  function timeAgo(ts: number) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "방금";
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  }

  return (
    <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", width: "100%", maxWidth: 500, margin: "16px auto 0" }}>
      <h4 style={{ margin: "0 0 12px", fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
        💬 댓글 {comments && comments.length > 0 && <span className="badge badge-purple" style={{ fontSize: "0.65rem", marginLeft: 4 }}>{comments.length}</span>}
      </h4>
      <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 12, paddingRight: 4 }}>
        {comments?.map((c) => (
          <div key={c._id} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, fontSize: "0.85rem" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
              {c.nickname.charAt(0)}
            </div>
            <div style={{ flex: 1, background: "rgba(0,0,0,0.03)", padding: "8px 12px", borderRadius: "0 12px 12px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>{c.nickname}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{timeAgo(c.createdAt)}</span>
                {c.nickname === nickname && (
                  <button onClick={() => removeComment({ commentId: c._id })}
                    style={{ background: "none", border: "none", color: "var(--danger)", fontSize: "0.7rem", cursor: "pointer", padding: 0, marginLeft: "auto" }}>삭제</button>
                )}
              </div>
              <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.4 }}>{c.text}</p>
            </div>
          </div>
        ))}
        {(!comments || comments.length === 0) && (
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem", margin: "20px 0" }}>아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
        )}
      </div>
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 6 }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="댓글 입력..." style={{ flex: 1, padding: "8px 12px", minHeight: 38, fontSize: "0.85rem", borderRadius: 20 }} />
        <button className="btn-primary" type="submit" disabled={!text.trim()}
          style={{ padding: "8px 16px", fontSize: "0.85rem", height: "auto", minHeight: 38, borderRadius: 20 }}>등록</button>
      </form>
    </div>
  );
}
