"use client";
import { useState } from "react";

// 이미지 파일을 base64로 변환
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Gemini Vision API 호출
export async function analyzeImage(file: File, type: "flight" | "accommodation" | "expense") {
  const { base64, mimeType } = await fileToBase64(file);
  const res = await fetch("/api/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType, type }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "분석 실패");
  return data.data;
}

interface Props {
  onFile: (file: File, preview: string) => void;
  onAnalyze?: (file: File) => void;
  analyzing?: boolean;
  preview?: string;
  label?: string;
}

export default function ImageUploader({ onFile, onAnalyze, analyzing, preview, label }: Props) {
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File) {
    const url = URL.createObjectURL(file);
    onFile(file, url);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }

  return (
    <div>
      <div
        className={`dropzone ${dragging ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("img-upload")?.click()}
      >
        {preview ? (
          <div style={{ position: "relative" }}>
            <img src={preview} alt="preview" style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 10, objectFit: "contain" }} />
            <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: 8 }}>이미지를 변경하려면 다시 클릭</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📎</div>
            <p style={{ color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.9rem" }}>{label || "이미지를 드래그하거나 클릭해서 업로드"}</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: 4 }}>JPG, PNG, WEBP 지원</p>
          </div>
        )}
        <input
          id="img-upload"
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      {preview && onAnalyze && (
        <button
          className="btn-primary"
          style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
          onClick={() => {
            const input = document.getElementById("img-upload") as HTMLInputElement;
            const file = input?.files?.[0];
            if (file) onAnalyze(file);
          }}
          disabled={analyzing}
        >
          {analyzing ? <><span className="spinner" /> AI 분석 중...</> : "🤖 AI로 자동 분석"}
        </button>
      )}
    </div>
  );
}
