"use client";

import { useEffect, useRef } from "react";

export interface Turn {
  role: "user" | "assistant";
  text: string;
  partial?: boolean; // true while still streaming
}

interface TranscriptProps {
  turns: Turn[];
}

export default function Transcript({ turns }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new tokens arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  if (turns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-samvad-muted text-sm text-center px-8">
          Hold the mic button and ask about today&apos;s news.<br />
          <span className="opacity-60">Try: &quot;What&apos;s happening in Europe today?&quot;</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {turns.map((turn, i) => (
        <div
          key={i}
          className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`
              max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
              ${
                turn.role === "user"
                  ? "bg-samvad-accent text-white rounded-br-sm"
                  : "bg-samvad-surface border border-samvad-border text-samvad-text rounded-bl-sm"
              }
              ${turn.partial ? "opacity-80" : ""}
            `}
          >
            {turn.text}
            {turn.partial && (
              <span className="inline-flex gap-0.5 ml-1">
                <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
