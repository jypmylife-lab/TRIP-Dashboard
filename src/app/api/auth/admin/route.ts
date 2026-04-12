import { NextResponse } from "next/server";

// POST /api/auth/admin
// body: { password: string }
// 관리자 비밀번호를 검증하고 세션 토큰 역할의 간단한 응답 반환
export async function POST(req: Request) {
  const { password } = await req.json();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json({ error: "서버 설정 오류: 관리자 비밀번호가 설정되지 않았습니다." }, { status: 500 });
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  // 서버 측 검증 성공 — 클라이언트에서 sessionStorage에 저장할 토큰 반환
  const token = Buffer.from(`admin:${Date.now()}`).toString("base64");
  return NextResponse.json({ ok: true, token });
}
