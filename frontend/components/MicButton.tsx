"use client";

import { useCallback, useEffect, useRef } from "react";
import { Mic } from "lucide-react";

interface MicButtonProps {
  state: "idle" | "listening" | "thinking" | "speaking" | "error";
  onPressStart: () => void;
  onPressEnd: () => void;
  disabled?: boolean;
  size?: "lg" | "md";
  label?: string;
}

export default function MicButton({
  state,
  onPressStart,
  onPressEnd,
  disabled,
  size = "lg",
  label = "Tap to speak",
}: MicButtonProps) {
  const isListening = state === "listening";
  const pressRef = useRef(false);

  const handleTap = useCallback(() => {
    if (disabled) return;
    if (isListening) {
      pressRef.current = false;
      onPressEnd();
    } else {
      pressRef.current = true;
      onPressStart();
    }
  }, [disabled, isListening, onPressStart, onPressEnd]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        if (!pressRef.current) {
          pressRef.current = true;
          onPressStart();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (pressRef.current) {
          pressRef.current = false;
          onPressEnd();
        }
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onPressStart, onPressEnd]);

  const sizeClasses = size === "lg" ? "w-20 h-20" : "w-16 h-16";
  const iconSize = size === "lg" ? 32 : 24;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleTap}
        disabled={disabled}
        aria-label={isListening ? "Tap to stop" : "Tap to speak"}
        className={`
          ${sizeClasses} rounded-full
          bg-[#FF8205] hover:bg-[#FA500F]
          flex items-center justify-center
          shadow-xl shadow-orange-500/20
          transition-all duration-200 select-none
          disabled:opacity-40 disabled:cursor-not-allowed
          active:scale-95
          ${isListening ? "ring-4 ring-[#FF8205]/30" : ""}
        `}
      >
        <Mic size={iconSize} strokeWidth={2.5} className="text-white" />
      </button>

      <p
        className="text-[10px] font-bold uppercase tracking-widest select-none"
        style={{ color: "#1E1E1E", opacity: 0.3 }}
      >
        {isListening ? "Listening..." : label}
      </p>
    </div>
  );
}
