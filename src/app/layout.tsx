import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "./providers";

export const metadata: Metadata = {
  title: "여행 에이전트 | 협업 여행 대시보드",
  description: "팀과 함께하는 스마트 여행 플래너 — 항공, 숙소, 지도, 날씨, 지출 정산을 한 곳에서",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
