"use client";

import { useEffect, useRef } from "react";

export interface Turn {
  role: "user" | "assistant";
  text: string;
  partial?: boolean;
}

interface TeleprompterProps {
  turns: Turn[];
}

export default function Teleprompter({ turns }: TeleprompterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const latestAssistant = [...turns]
    .reverse()
    .find((t) => t.role === "assistant");

  // Auto-scroll to keep latest text visible at the bottom of the window
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [latestAssistant?.text]);

  if (!latestAssistant) {
    return (
      <div className="flex-1 flex items-center justify-center px-8">
        <p
          className="text-2xl md:text-3xl font-semibold leading-tight text-center"
          style={{ color: "#1E1E1E", opacity: 0.4 }}
        >
          Tap the mic and ask about today&apos;s news
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Top fade mask */}
      <div
        className="absolute top-0 left-0 right-0 h-16 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, #FFFAEB, transparent)",
        }}
      />

      {/* Scrolling text container */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-8 flex flex-col justify-end"
        style={{ scrollbarWidth: "none" }}
      >
        {/* Spacer to push text down initially */}
        <div className="min-h-[40%]" />

        <p
          className="text-2xl md:text-3xl font-semibold leading-tight pb-8"
          style={{ color: "#1E1E1E" }}
        >
          {latestAssistant.text}
          {latestAssistant.partial && (
            <span
              className="inline-block w-[3px] h-[0.85em] ml-1 align-baseline animate-pulse"
              style={{ backgroundColor: "#FF8205" }}
            />
          )}
        </p>
      </div>

      {/* Bottom fade mask */}
      <div
        className="absolute bottom-0 left-0 right-0 h-12 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(to top, #FFFAEB, transparent)",
        }}
      />
    </div>
  );
}
