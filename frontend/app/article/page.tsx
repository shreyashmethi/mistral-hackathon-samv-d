"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Settings, Mic } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const CURRENT_AI_MESSAGE =
  "President Christine Lagarde emphasized that while inflation remains too high for too long, the previous rate hikes are forcefully transmitting to the financing conditions. The European Central Bank held rates steady at their March meeting, breaking from the recent cutting cycle. Markets had expected a fourth consecutive cut, but persistent services inflation changed the calculus. This signals a more cautious approach going forward, with the ECB wanting to see further evidence before easing again. Analysts suggest the pause could last through the summer, depending on incoming economic data from across the eurozone.";

// ─── Pixel Waveform ───────────────────────────────────────────────────────────

const NUM_COLS = 38;
const MAX_ROWS = 10;
const CELL_H = 10;
const CELL_GAP = 1;

const TOP_COLORS: string[] = [
  "#FFE000",
  "#FFD000",
  "#FFBB00",
  "#FFA000",
  "#FF8800",
];

const BOTTOM_COLORS: string[] = [
  "#FF6600",
  "#FF4400",
  "#EE2200",
  "#DD1100",
  "#CC0000",
];

function PixelWaveform({ speaking = false }: { speaking?: boolean }) {
  const heightsRef = useRef<number[]>(
    Array.from({ length: NUM_COLS }, () => Math.random() * (MAX_ROWS / 2 - 1) + 1)
  );
  const targetsRef = useRef<number[]>(
    Array.from({ length: NUM_COLS }, () => Math.random() * (MAX_ROWS / 2 - 1) + 1)
  );
  const [colHeights, setColHeights] = useState<number[]>(heightsRef.current.slice());

  useEffect(() => {
    const id = setInterval(() => {
      if (speaking) {
        // Simulate voice energy — varied amplitudes across columns
        targetsRef.current = targetsRef.current.map((t, i) => {
          // Create a wave-like pattern that shifts over time for organic feel
          const time = Date.now() / 1000;
          const wave = Math.sin((i / NUM_COLS) * Math.PI * 2 + time * 3) * 0.3;
          // Random speech energy: most columns active, occasional peaks
          const energy = 1.5 + Math.random() * 3.0 + wave;
          // Blend toward new energy (don't jump instantly)
          const blended = t + (energy - t) * 0.35;
          return Math.max(1, Math.min(MAX_ROWS / 2, blended));
        });
      } else {
        // Idle — gentle random drift
        targetsRef.current = targetsRef.current.map((t) => {
          if (Math.random() < 0.85) {
            const next = t + (Math.random() * 2.0 - 1.0);
            return Math.max(1, Math.min(MAX_ROWS / 2, next));
          }
          return t;
        });
      }

      heightsRef.current = heightsRef.current.map((h, i) => {
        const target = targetsRef.current[i];
        const easeFactor = speaking ? 0.45 : 0.6;
        const eased = h + (target - h) * easeFactor;
        const noiseAmt = speaking ? 0.3 : 0.075;
        const noise = Math.random() * noiseAmt * 2 - noiseAmt;
        const next = eased + noise;
        return Math.max(0.5, Math.min(MAX_ROWS / 2, next));
      });

      setColHeights(heightsRef.current.slice());
    }, 40);

    return () => clearInterval(id);
  }, [speaking]);

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

// ─── Line-breaking utility ────────────────────────────────────────────────────

const WORDS_PER_LINE = 6;

function splitIntoLines(text: string): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < words.length; i++) {
    current.push(words[i]);

    const isBreakPoint =
      current.length >= WORDS_PER_LINE - 1 && (
        words[i].endsWith(",") ||
        words[i].endsWith(".") ||
        words[i].endsWith(";") ||
        words[i].endsWith(":") ||
        (i + 1 < words.length && ["that", "which", "while", "but", "and", "with", "from", "the", "a", "to", "in", "at", "by", "for", "as"].includes(words[i + 1]?.toLowerCase()))
      );

    if (current.length >= WORDS_PER_LINE + 2 || isBreakPoint) {
      lines.push(current.join(" "));
      current = [];
    }
  }

  if (current.length > 0) {
    lines.push(current.join(" "));
  }

  return lines;
}

// ─── Teleprompter Component ───────────────────────────────────────────────────

function LyricsTeleprompter({
  lines,
  currentLineIndex,
  currentWordInLine,
}: {
  lines: string[];
  currentLineIndex: number;
  currentWordInLine: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const scrollTarget = useRef(0);
  const scrollCurrent = useRef(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const activeLine = activeLineRef.current;
      const containerHeight = containerRef.current.clientHeight;
      scrollTarget.current = Math.max(0, activeLine.offsetTop - containerHeight * 0.5);
    }
  }, [currentLineIndex]);

  useEffect(() => {
    const tick = () => {
      scrollCurrent.current += (scrollTarget.current - scrollCurrent.current) * 0.08;
      if (containerRef.current) {
        containerRef.current.scrollTop = scrollCurrent.current;
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  const LOOKAHEAD = 1;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ maxHeight: "100%" }}
    >
      <div className="flex flex-col gap-5 py-12">
        {lines.map((line, lineIdx) => {
          const isCurrent = lineIdx === currentLineIndex;
          const isPast = lineIdx < currentLineIndex;
          const isUpcoming = lineIdx > currentLineIndex && lineIdx <= currentLineIndex + LOOKAHEAD;
          const isFarFuture = lineIdx > currentLineIndex + LOOKAHEAD;

          if (isFarFuture) return null;

          let opacity = 0;
          if (isCurrent) {
            opacity = 1;
          } else if (isPast) {
            const distance = currentLineIndex - lineIdx;
            if (distance === 1) opacity = 0.25;
            else opacity = 0;
          } else if (isUpcoming) {
            opacity = 0.2;
          }

          const fontSize = isCurrent ? "1.25rem" : "1.05rem";
          const fontWeight = isCurrent ? 700 : 500;
          const lineHeight = isCurrent ? 1.35 : 1.4;

          if (isPast && currentLineIndex - lineIdx > 1) return null;

          const lineWords = line.split(" ");

          return (
            <motion.div
              key={lineIdx}
              ref={isCurrent ? activeLineRef : undefined}
              initial={{ opacity: 0, y: 12 }}
              animate={{
                opacity,
                y: 0,
              }}
              transition={{
                duration: 0.8,
                ease: [0.25, 0.1, 0.25, 1.0],
                opacity: { duration: 1.0, ease: [0.25, 0.1, 0.25, 1.0] },
              }}
              style={{
                fontSize,
                fontWeight,
                lineHeight,
                color: "#1E1E1E",
                willChange: "opacity, transform",
                transition: "font-size 0.6s cubic-bezier(0.25, 0.1, 0.25, 1.0), font-weight 0.6s cubic-bezier(0.25, 0.1, 0.25, 1.0)",
              }}
            >
              {isCurrent ? (
                <span>
                  {lineWords.map((word, wordIdx) => {
                    const isSpoken = wordIdx <= currentWordInLine;
                    const isActive = wordIdx === currentWordInLine;
                    return (
                      <motion.span
                        key={wordIdx}
                        animate={{
                          opacity: isSpoken ? 1 : 0.15,
                          filter: isSpoken ? "blur(0px)" : "blur(0.5px)",
                        }}
                        transition={{
                          duration: 0.4,
                          ease: [0.25, 0.1, 0.25, 1.0],
                        }}
                        style={{
                          display: "inline-block",
                          marginRight: "0.28em",
                          color: isActive ? "#FF8205" : "#1E1E1E",
                          transition: "color 0.3s ease",
                        }}
                      >
                        {word}
                      </motion.span>
                    );
                  })}
                  <motion.span
                    className="inline-block w-[2.5px] h-5 ml-0.5 bg-[#FF8205] align-middle rounded-full"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </span>
              ) : (
                <span style={{ transition: "opacity 0.8s ease" }}>{line}</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ArticleModeScreen() {
  const lines = useMemo(() => splitIntoLines(CURRENT_AI_MESSAGE), []);

  const [currentLine, setCurrentLine] = useState(0);
  const [currentWord, setCurrentWord] = useState(-1);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    let lineIdx = 0;
    let wordIdx = -1;
    let timeout: ReturnType<typeof setTimeout>;

    // Calibrated to ElevenLabs flash v2.5 (~2.8 WPS)
    const getWordDelay = (word: string, isLineEnd: boolean): number => {
      const base = 300;
      const lengthBonus = Math.min(word.length * 12, 80);
      let pause = 0;
      if (word.endsWith(".") || word.endsWith("!") || word.endsWith("?")) pause = 450;
      else if (word.endsWith(",") || word.endsWith(";") || word.endsWith(":")) pause = 220;
      if (isLineEnd) pause = Math.max(pause, 500);
      const jitter = (Math.random() - 0.5) * 40;
      return base + lengthBonus + pause + jitter;
    };

    const advance = () => {
      if (lineIdx >= lines.length) {
        setIsSpeaking(false);
        return;
      }

      const wordsInLine = lines[lineIdx].split(" ");
      wordIdx++;

      if (wordIdx >= wordsInLine.length) {
        lineIdx++;
        wordIdx = 0;
        if (lineIdx >= lines.length) {
          setIsSpeaking(false);
          return;
        }
      }

      setCurrentLine(lineIdx);
      setCurrentWord(wordIdx);

      const currentWordText = lines[lineIdx].split(" ")[wordIdx] || "";
      const atLineEnd = wordIdx >= lines[lineIdx].split(" ").length - 1;
      const delay = getWordDelay(currentWordText, atLineEnd);

      timeout = setTimeout(advance, delay);
    };

    setIsSpeaking(true);
    timeout = setTimeout(advance, 400);
    return () => clearTimeout(timeout);
  }, [lines]);

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white relative overflow-hidden font-sans">

      {/* ── Ambient blend – TOP HALF ONLY ── */}
      <div className="absolute top-0 left-0 right-0 h-1/2 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 z-10 bg-[#FFFAEB]/70 mix-blend-overlay" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/news-bg.jpg"
          alt=""
          className="w-full h-full object-cover blur-3xl opacity-45 scale-125"
        />
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-transparent via-white/20 to-white" />
      </div>

      {/* ── Top Bar ── */}
      <div className="flex justify-between items-center px-6 pt-12 pb-4 z-10 relative">
        <h1 className="text-sm font-bold tracking-widest text-[#1E1E1E] uppercase opacity-40">
          Samv&#257;d Live
        </h1>
        {isSpeaking && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF8205] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF8205]" />
            </span>
            <span className="text-xs font-semibold text-[#FF8205] uppercase tracking-wider">
              Speaking
            </span>
          </div>
        )}
        <Link
          href="/settings"
          className="p-2 -mr-2 text-[#1E1E1E] opacity-40 hover:opacity-100 transition-opacity"
        >
          <Settings size={20} />
        </Link>
      </div>

      {/* ── Teleprompter Area ── */}
      <div className="flex-1 flex flex-col justify-center px-8 pb-24 relative z-10 overflow-hidden">
        <LyricsTeleprompter
          lines={lines}
          currentLineIndex={currentLine}
          currentWordInLine={currentWord}
        />
      </div>

      {/* ── Bottom Controls ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-6 flex flex-col items-center gap-4">
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-transparent -z-10" />

        {/* Pixel waveform – edge to edge */}
        <PixelWaveform speaking={isSpeaking} />

        {/* Mic button */}
        <div className="relative">
          {isSpeaking && (
            <span className="absolute inset-0 rounded-full bg-[#FF8205]/20 animate-ping" />
          )}
          <button className={`w-14 h-14 rounded-full bg-[#FF8205] text-white flex items-center justify-center shadow-lg shadow-orange-500/20 active:scale-95 transition-all duration-200 hover:bg-[#FA500F] ${
            isSpeaking ? "ring-4 ring-[#FF8205]/30" : ""
          }`}>
            <Mic size={24} strokeWidth={2.5} />
          </button>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <p className="text-[9px] font-bold text-[#1E1E1E] opacity-30 uppercase tracking-widest">
              {isSpeaking ? "AI Speaking..." : "Tap to speak"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
