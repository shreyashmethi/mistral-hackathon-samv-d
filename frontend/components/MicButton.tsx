"use client";

import { useEffect, useRef, useState } from "react";

interface MicButtonProps {
  state: "idle" | "listening" | "thinking" | "speaking" | "error";
  onPressStart: () => void;
  onPressEnd: () => void;
  disabled?: boolean;
}

export default function MicButton({ state, onPressStart, onPressEnd, disabled }: MicButtonProps) {
  const [pressing, setPressing] = useState(false);
  const pressRef = useRef(false);

  const handleStart = () => {
    if (disabled || pressing) return;
    setPressing(true);
    pressRef.current = true;
    onPressStart();
  };

  const handleEnd = () => {
    if (!pressRef.current) return;
    setPressing(false);
    pressRef.current = false;
    onPressEnd();
  };

  // Keyboard: Space to push-to-talk
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        handleStart();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleEnd();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  const ringColor = {
    idle: "ring-samvad-border",
    listening: "ring-samvad-blue",
    thinking: "ring-samvad-accent",
    speaking: "ring-samvad-green",
    error: "ring-samvad-red",
  }[state];

  const bgColor = pressing
    ? "bg-samvad-blue"
    : state === "error"
    ? "bg-samvad-red/20"
    : state === "speaking"
    ? "bg-samvad-green/20"
    : "bg-samvad-surface";

  const pulseClass =
    state === "listening" || pressing ? "animate-pulse" : state === "idle" ? "animate-breathe" : "";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => { e.preventDefault(); handleStart(); }}
        onTouchEnd={(e) => { e.preventDefault(); handleEnd(); }}
        disabled={disabled}
        aria-label={pressing ? "Release to send" : "Hold to speak (or hold Space)"}
        className={`
          relative w-24 h-24 rounded-full
          ring-4 ${ringColor} ring-offset-2 ring-offset-samvad-bg
          ${bgColor} ${pulseClass}
          flex items-center justify-center
          transition-all duration-200 select-none
          disabled:opacity-40 disabled:cursor-not-allowed
          active:scale-95
        `}
      >
        {/* Mic icon */}
        <MicIcon pressing={pressing} state={state} />

        {/* Outer glow when listening */}
        {(pressing || state === "listening") && (
          <span className="absolute inset-0 rounded-full bg-samvad-blue/20 animate-ping" />
        )}
      </button>

      <p className="text-xs text-samvad-muted select-none">
        {pressing ? "Listening… release to send" : "Hold to speak · Space"}
      </p>
    </div>
  );
}

function MicIcon({ pressing, state }: { pressing: boolean; state: string }) {
  const color =
    pressing || state === "listening"
      ? "#3b82f6"
      : state === "speaking"
      ? "#22c55e"
      : state === "error"
      ? "#ef4444"
      : "#e2e8f0";

  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}
