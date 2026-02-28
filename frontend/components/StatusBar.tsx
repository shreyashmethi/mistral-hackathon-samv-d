"use client";

import type { AppState } from "@/lib/api";

interface StatusBarProps {
  state: AppState;
  storyIndex: number;
  totalStories: number;
}

const STATE_LABELS: Record<AppState, string> = {
  idle: "Ready",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Error",
};

const STATE_COLORS: Record<AppState, string> = {
  idle: "text-samvad-muted",
  listening: "text-samvad-blue",
  thinking: "text-samvad-accent",
  speaking: "text-samvad-green",
  error: "text-samvad-red",
};

const DOT_COLORS: Record<AppState, string> = {
  idle: "bg-samvad-muted",
  listening: "bg-samvad-blue animate-pulse",
  thinking: "bg-samvad-accent animate-pulse",
  speaking: "bg-samvad-green animate-pulse",
  error: "bg-samvad-red animate-pulse",
};

export default function StatusBar({ state, storyIndex, totalStories }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-samvad-surface border-b border-samvad-border">
      {/* Left: story indicator */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalStories }).map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === storyIndex ? "bg-samvad-accent" : "bg-samvad-border"
            }`}
          />
        ))}
        <span className="ml-1 text-xs text-samvad-muted">
          {totalStories > 0 ? `Story ${storyIndex + 1} / ${totalStories}` : "Loading…"}
        </span>
      </div>

      {/* Right: status indicator */}
      <div className={`flex items-center gap-1.5 text-xs ${STATE_COLORS[state]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[state]}`} />
        {STATE_LABELS[state]}
      </div>
    </div>
  );
}
