"use client";

import { useEffect, useRef, useState } from "react";
import type { AppState } from "@/lib/api";

interface WaveformProps {
  state: AppState;
  analyserNode?: AnalyserNode | null;
}

const NUM_COLS = 38;
const MAX_ROWS = 10;
const CELL_H = 10;
const CELL_GAP = 1;

// Top half (rows 0-4): yellow at tip → amber at center
const TOP_COLORS = ["#FFE000", "#FFD000", "#FFBB00", "#FFA000", "#FF8800"];
// Bottom half (rows 5-9): orange at center → deep red at tip
const BOTTOM_COLORS = ["#FF6600", "#FF4400", "#EE2200", "#DD1100", "#CC0000"];

export default function Waveform({ state, analyserNode }: WaveformProps) {
  const heightsRef = useRef<number[]>(
    Array.from({ length: NUM_COLS }, () => Math.random() * (MAX_ROWS / 2 - 1) + 1)
  );
  const targetsRef = useRef<number[]>(
    Array.from({ length: NUM_COLS }, () => Math.random() * (MAX_ROWS / 2 - 1) + 1)
  );
  const [colHeights, setColHeights] = useState<number[]>(heightsRef.current.slice());

  useEffect(() => {
    const id = setInterval(() => {
      // Update targets based on audio or state
      if (analyserNode && (state === "listening" || state === "speaking")) {
        const bufLen = analyserNode.frequencyBinCount;
        const data = new Uint8Array(bufLen);
        analyserNode.getByteFrequencyData(data);
        const step = Math.floor(bufLen / NUM_COLS);
        targetsRef.current = targetsRef.current.map((_, i) => {
          const val = data[i * step] / 255;
          return Math.max(0.5, val * (MAX_ROWS / 2));
        });
      } else if (state === "thinking") {
        const t = Date.now() / 1000;
        targetsRef.current = targetsRef.current.map((_, i) => {
          return 1.5 + 2.5 * Math.abs(Math.sin((i / NUM_COLS) * Math.PI * 3 + t * 2.5));
        });
      } else {
        // idle — random drift
        targetsRef.current = targetsRef.current.map((t) => {
          if (Math.random() < 0.85) {
            const next = t + (Math.random() * 2.0 - 1.0);
            return Math.max(1, Math.min(MAX_ROWS / 2, next));
          }
          return t;
        });
      }

      // Ease toward targets
      heightsRef.current = heightsRef.current.map((h, i) => {
        const target = targetsRef.current[i];
        const eased = h + (target - h) * 0.6;
        const noise = Math.random() * 0.15 - 0.075;
        return Math.max(0.5, Math.min(MAX_ROWS / 2, eased + noise));
      });

      setColHeights(heightsRef.current.slice());
    }, 40);

    return () => clearInterval(id);
  }, [state, analyserNode]);

  const center = MAX_ROWS / 2;

  return (
    <div
      className="flex w-full"
      style={{ gap: CELL_GAP, padding: "0 4px", alignItems: "center" }}
    >
      {colHeights.map((height, col) => {
        const half = Math.round(height);
        return (
          <div
            key={col}
            className="flex flex-col flex-1"
            style={{ gap: CELL_GAP }}
          >
            {Array.from({ length: MAX_ROWS }).map((_, row) => {
              const distFromCenter = Math.abs(row - center + 0.5);
              const lit = distFromCenter < half;
              const isTop = row < center;
              const edgeIdx = Math.min(Math.floor(distFromCenter), 4);
              const color = isTop
                ? TOP_COLORS[4 - edgeIdx]
                : BOTTOM_COLORS[edgeIdx];
              return (
                <div
                  key={row}
                  style={{
                    height: CELL_H,
                    borderRadius: 2,
                    backgroundColor: lit ? color : "transparent",
                    transition: "background-color 0.18s ease-in-out",
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
