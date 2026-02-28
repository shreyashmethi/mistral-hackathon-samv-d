import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Samvād — Your AI News Companion",
  description:
    "Voice-first AI news companion. Ask about today's news, get spoken briefings, and dive deep — all through conversation.",
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
    <html lang={`en`} className={inter.variable}>
      <body className="antialiased min-h-screen flex items-center justify-center bg-neutral-900">
        <div className="relative w-full max-w-[430px] min-h-screen bg-white shadow-2xl overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
