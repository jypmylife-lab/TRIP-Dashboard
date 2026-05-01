"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import ItineraryComments from "./ItineraryComments";

export default function ItineraryPhotos({ item, nickname }: { item: any; nickname: string }) {
  const [uploading, setUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const generateUploadUrl = useMutation(api.itinerary.generateUploadUrl);
  const updateItem = useMutation(api.itinerary.updateItem);
  const removePhoto = useMutation(api.itinerary.removePhoto);
  const photoUrls = useQuery(api.itinerary.getPhotoUrls, {
    storageIds: item.photos || [],
  });
  const allComments = useQuery(api.itinerary.listCommentsByItem, { itemId: item._id });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || (item.photos?.length || 0) >= 5) return;
    setUploading(true);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await res.json();
      const newPhotos = [...(item.photos || []), storageId];
      await updateItem({ itemId: item._id, photos: newPhotos });
    } catch (err) { console.error("Upload failed", err); }
    finally { setUploading(false); e.target.value = ""; }
  }

  async function handleRemovePhoto(storageId: string) {
    await removePhoto({ itemId: item._id, storageId });
    if (viewPhoto === storageId) setViewPhoto(null);
  }

  const photos = item.photos || [];

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {photos.map((id: string) => {
          const url = photoUrls?.[id];
          const commentCount = allComments?.filter(c => c.photoId === id).length || 0;
          return (
            <div key={id} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)" }}>
              {url ? (
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                  onClick={() => setViewPhoto(id)} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                </div>
              )}
              {commentCount > 0 && (
                <div style={{ position: "absolute", bottom: 2, left: 2, background: "var(--accent)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, padding: "2px 6px", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                  💬 {commentCount}
                </div>
              )}
              <button onClick={(e) => { e.stopPropagation(); handleRemovePhoto(id); }}
                style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          );
        })}
        {photos.length < 5 && (
          <div style={{ display: "flex", gap: 6 }}>
            <label style={{ width: 72, height: 72, borderRadius: 10, border: "2px dashed rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: uploading ? "wait" : "pointer", background: "#f8fafc", fontSize: "0.7rem", color: "var(--text-muted)", gap: 2 }}>
              {uploading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <>📷<span>촬영</span></>}
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
            </label>
            <label style={{ width: 72, height: 72, borderRadius: 10, border: "2px dashed rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: uploading ? "wait" : "pointer", background: "#f8fafc", fontSize: "0.7rem", color: "var(--text-muted)", gap: 2 }}>
              {uploading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <>🖼️<span>앨범</span></>}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        )}
      </div>

      {/* 사진 확대 및 댓글 모달 */}
      {viewPhoto && photoUrls?.[viewPhoto] && (
        <div className="modal-overlay" onClick={() => setViewPhoto(null)} style={{ zIndex: 200, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 600, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            <img src={photoUrls[viewPhoto]} alt="" style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }} />
            <button onClick={() => setViewPhoto(null)}
              style={{ position: "absolute", top: -12, right: -12, width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", zIndex: 10 }}>✕</button>
            
            {/* 사진별 댓글 영역 */}
            <ItineraryComments item={item} photoId={viewPhoto} nickname={nickname} />
          </div>
        </div>
      )}
    </div>
  );
}
