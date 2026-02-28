import { useState, useEffect, useRef } from "react";
import { Settings, Mic } from "lucide-react";
import { Link } from "react-router";
import { motion } from "motion/react";
import bgImage from "figma:asset/e8b63eb5cab3d68b498c2097718c22cce0aaadd8.png";

const CURRENT_AI_MESSAGE =
  "President Christine Lagarde emphasized that while inflation remains too high for too long, the previous rate hikes are forcefully transmitting to the financing conditions.";

// ─── Pixel Waveform ───────────────────────────────────────────────────────────

const NUM_COLS = 38;
const MAX_ROWS = 10;  // must be even; mirror axis = center
const CELL_H = 10;
const CELL_GAP = 1;

// Top half (rows 0–4): yellow at tip → orange at center
const TOP_COLORS: string[] = [
  "#FFE000",  // tip — bright yellow
  "#FFD000",
  "#FFBB00",
  "#FFA000",
  "#FF8800",  // near center — amber
];

// Bottom half (rows 5–9): orange at center → deep red at tip
const BOTTOM_COLORS: string[] = [
  "#FF6600",  // near center — orange
  "#FF4400",
  "#EE2200",
  "#DD1100",
  "#CC0000",  // tip — deep red
];

function PixelWaveform() {
  // Heights now represent half-amplitude (how many rows to light on each side of center)
  const heightsRef = useRef<number[]>(
    Array.from({ length: NUM_COLS }, () => Math.random() * (MAX_ROWS / 2 - 1) + 1)
  );
  const targetsRef = useRef<number[]>(
    Array.from({ length: NUM_COLS }, () => Math.random() * (MAX_ROWS / 2 - 1) + 1)
  );
  const [colHeights, setColHeights] = useState<number[]>(heightsRef.current.slice());

  useEffect(() => {
    const id = setInterval(() => {
      targetsRef.current = targetsRef.current.map((t) => {
        if (Math.random() < 0.85) {
          const next = t + (Math.random() * 2.0 - 1.0);
          return Math.max(1, Math.min(MAX_ROWS / 2, next));
        }
        return t;
      });

      heightsRef.current = heightsRef.current.map((h, i) => {
        const target = targetsRef.current[i];
        const eased = h + (target - h) * 0.6;
        const noise = Math.random() * 0.15 - 0.075;  // very low noise
        const next = eased + noise;
        return Math.max(0.5, Math.min(MAX_ROWS / 2, next));
      });

      setColHeights(heightsRef.current.slice());
    }, 40);

    return () => clearInterval(id);
  }, []);

  const center = MAX_ROWS / 2; // 5 — rows 0–4 are top half, 5–9 are bottom half

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
              // distFromCenter is LARGE at tips, SMALL near center
              // TOP: large dist = yellow tip, small dist = amber center → TOP_COLORS[4 - edgeIdx]
              // BOTTOM: small dist = orange center, large dist = red tip → BOTTOM_COLORS[edgeIdx]
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ConversationScreen() {
  const [displayedText, setDisplayedText] = useState("");
  const fullText = CURRENT_AI_MESSAGE;

  useEffect(() => {
    let idx = 0;
    const id = setInterval(() => {
      if (idx <= fullText.length) {
        setDisplayedText(fullText.slice(0, idx));
        idx++;
      } else {
        clearInterval(id);
      }
    }, 40);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white relative overflow-hidden font-sans">

      {/* ── Ambient blend – TOP HALF ONLY ── */}
      <div className="absolute top-0 left-0 right-0 h-1/2 z-0 overflow-hidden pointer-events-none">
        <img
          src={bgImage}
          alt=""
          className="w-full h-full object-cover scale-125"
        />
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-transparent via-transparent via-60% to-white" />
      </div>

      {/* ── Top Bar ── */}
      <div className="flex justify-between items-center px-6 pt-12 pb-4 z-10 relative">
        <h1 className="text-sm font-bold tracking-widest text-[#1E1E1E] uppercase opacity-40">
          Samvād Live
        </h1>
        <Link
          to="/settings"
          className="p-2 -mr-2 text-[#1E1E1E] opacity-40 hover:opacity-100 transition-opacity"
        >
          <Settings size={20} />
        </Link>
      </div>

      {/* ── Teleprompter Area ── */}
      <div className="flex-1 flex flex-col justify-center px-8 pb-24 mt-[-60px] relative z-10">
        <div className="relative">
          <p className="text-2xl md:text-3xl font-semibold leading-tight text-[#1E1E1E] opacity-10 absolute top-0 left-0 select-none -z-10">
            {fullText}
          </p>
          <motion.p
            className="text-2xl md:text-3xl font-semibold leading-tight text-[#1E1E1E]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {displayedText}
            <span className="inline-block w-[3px] h-6 ml-1 bg-[#FF8205] animate-pulse align-middle" />
          </motion.p>
        </div>
      </div>

      {/* ── Bottom Controls ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-10 flex flex-col items-center gap-6">
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-transparent -z-10" />

        {/* Pixel waveform – edge to edge */}
        <PixelWaveform />

        {/* Mic button */}
        <div className="relative">
          <button className="w-20 h-20 rounded-full bg-[#FF8205] text-white flex items-center justify-center shadow-xl shadow-orange-500/20 active:scale-95 transition-all duration-200 hover:bg-[#FA500F]">
            <Mic size={32} strokeWidth={2.5} />
          </button>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <p className="text-[10px] font-bold text-[#1E1E1E] opacity-30 uppercase tracking-widest">
              Tap to speak
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}