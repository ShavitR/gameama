import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "המוח הכוורתי - משחק פתיחת יום",
  description: "משחק פתיחת יום כיתתי מהיר וקצבי. נחשו מה רוב הכיתה חושבת וצברו נקודות!",
  other: {
    "google": "notranslate",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning translate="no" className="notranslate">
      <body>
        <div className="honeycomb-overlay" />
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />
        {children}
      </body>
    </html>
  );
}
