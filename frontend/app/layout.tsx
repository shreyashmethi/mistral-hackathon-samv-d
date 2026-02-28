import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Samvād — Your AI News Companion",
  description: "Voice-first AI news companion. Ask about today's news, get spoken briefings, and dive deep — all through conversation.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-samvad-bg text-samvad-text antialiased">{children}</body>
    </html>
  );
}
