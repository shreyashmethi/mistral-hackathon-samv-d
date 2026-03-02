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
    Array.from({ length: NUM_COLS }, () => 1.2)
  );
  const velocities = useRef<number[]>(Array(NUM_COLS).fill(0));
  const audioLevelRef = useRef(0);
  const [colHeights, setColHeights] = useState<number[]>(heightsRef.current.slice());

  useEffect(() => {
    const id = setInterval(() => {
      // Compute audio energy level
      let energy = 0;

      if (analyserNode && state === "listening") {
        const bufLen = analyserNode.fftSize;
        const data = new Uint8Array(bufLen);
        analyserNode.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < bufLen; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / bufLen);
        // Ultra-sensitive: 25x amplification + minimum floor of 0.35 while listening
        energy = Math.max(0.35, Math.min(rms * 25, 1));
      } else if (state === "speaking") {
        energy = 0.7 + Math.random() * 0.3;
      } else if (state === "thinking") {
        energy = 0.35;
      } else {
        energy = 0;
      }

      // Smooth the energy level
      audioLevelRef.current += (energy - audioLevelRef.current) * 0.3;
      const level = audioLevelRef.current;

      const t = performance.now() / 1000;
      const arr = heightsRef.current;

      // Idle sine wave — direct evaluation for crisp shape
      const idleTargets = Array.from({ length: NUM_COLS }, (_, i) => {
        const x = i / (NUM_COLS - 1);
        const phase = x * Math.PI * 2 * 1.5 + t * 1.4;
        return 2.0 + Math.sin(phase) * 1.5;
      });

      // Blend: idle → spring physics based on energy level
      const blend = Math.min(level / 0.3, 1); // 0 = pure idle sine, 1 = full spring physics

      heightsRef.current = arr.map((prev, i) => {
        if (blend < 1) {
          // Snap closely to sine target for well-defined wave shape
          const idleVal = idleTargets[i];
          const eased = prev + (idleVal - prev) * 0.45;

          if (blend === 0) return eased;

          // Partial blend: compute spring value too and mix
          const springVal = computeSpring(arr, prev, i, t, level);
          return eased * (1 - blend) + springVal * blend;
        }

        return computeSpring(arr, prev, i, t, level);
      });

      function computeSpring(
        cols: number[], prev: number, i: number, time: number, lvl: number
      ): number {
        const left = cols[i - 1] ?? prev;
        const right = cols[i + 1] ?? prev;

        // Neighbor cohesion — columns pull toward neighbors (spring tension)
        const cohesion = (left + right - 2 * prev) * 0.15;

        // Driving wave — speed and amplitude scale with energy
        const wave =
          Math.sin((i / NUM_COLS) * Math.PI * 2 + time * (1.2 + lvl * 4)) *
          (0.3 + lvl * 1.2);

        // Second harmonic for complexity during speech
        const harmonic =
          Math.sin((i / NUM_COLS) * Math.PI * 5 + time * (3 + lvl * 3)) *
          (lvl * 0.5);

        // Velocity integration with damping
        velocities.current[i] =
          velocities.current[i] * 0.78 +
          (wave + harmonic + cohesion) * 0.22;

        const next = prev + velocities.current[i];

        // Range scales with energy: min 1.0 block always lit
        const lo = Math.max(1.0, 0.5 - lvl * 0.2);
        const hi = 2.0 + lvl * (MAX_ROWS / 2 - 2.0);
        return Math.max(lo, Math.min(hi, next));
      }

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
