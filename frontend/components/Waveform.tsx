"use client";

import { useEffect, useRef } from "react";
import type { AppState } from "@/lib/api";

interface WaveformProps {
  state: AppState;
  analyserNode?: AnalyserNode | null;
}

const STATE_COLORS: Record<AppState, string> = {
  idle: "#334155",
  listening: "#3b82f6",
  thinking: "#6366f1",
  speaking: "#22c55e",
  error: "#ef4444",
};

export default function Waveform({ state, analyserNode }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const color = STATE_COLORS[state];
    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, W, H);

      if (analyserNode && (state === "listening" || state === "speaking")) {
        // Real audio waveform
        const bufLen = analyserNode.fftSize;
        const data = new Uint8Array(bufLen);
        analyserNode.getByteTimeDomainData(data);

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        const sliceW = W / bufLen;
        let x = 0;
        for (let i = 0; i < bufLen; i++) {
          const v = data[i] / 128.0;
          const y = (v * H) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceW;
        }
        ctx.lineTo(W, H / 2);
        ctx.stroke();
      } else {
        // Idle/thinking: draw a calm sine wave animation
        const t = Date.now() / 1000;
        const amplitude = state === "thinking" ? H * 0.12 : H * 0.06;
        const freq = state === "thinking" ? 2.5 : 1.2;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (let x = 0; x <= W; x++) {
          const y = H / 2 + amplitude * Math.sin((x / W) * Math.PI * 2 * freq + t * 3);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state, analyserNode]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={80}
      className="w-full h-20 rounded-xl"
      style={{ background: "#0a0a0f" }}
    />
  );
}
