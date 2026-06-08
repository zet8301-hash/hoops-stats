import type { Metadata } from "next";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

export const metadata: Metadata = {
  title: "HOOPS STATS",
  description: "친구들과 함께하는 농구 통계 트래커",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
