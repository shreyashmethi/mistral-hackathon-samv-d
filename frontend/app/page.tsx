"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Settings, Mic } from "lucide-react";
import { motion } from "framer-motion";
import Waveform from "@/components/Waveform";
import { AudioCapture } from "@/lib/stt";
import { TTSClient } from "@/lib/tts";
import { WSSession, newSessionId, api, type AppState, type Story } from "@/lib/api";

// ─── Line-breaking utility ────────────────────────────────────────────────────

const WORDS_PER_LINE = 6;

function splitIntoLines(text: string): string[] {
  const words = text.split(" ").filter((w) => w.length > 0);
  const lines: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < words.length; i++) {
    current.push(words[i]);

    const isBreakPoint =
      current.length >= WORDS_PER_LINE - 1 &&
      (words[i].endsWith(",") ||
        words[i].endsWith(".") ||
        words[i].endsWith(";") ||
        words[i].endsWith(":") ||
        (i + 1 < words.length &&
          [
            "that", "which", "while", "but", "and", "with", "from",
            "the", "a", "to", "in", "at", "by", "for", "as",
          ].includes(words[i + 1]?.toLowerCase())));

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

  // Butter-smooth scroll using lerp
  const scrollTarget = useRef(0);
  const scrollCurrent = useRef(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const activeLine = activeLineRef.current;
      const containerHeight = containerRef.current.clientHeight;
      scrollTarget.current = Math.max(
        0,
        activeLine.offsetTop - containerHeight * 0.5
      );
    }
  }, [currentLineIndex]);

  useEffect(() => {
    const tick = () => {
      scrollCurrent.current +=
        (scrollTarget.current - scrollCurrent.current) * 0.08;
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
          const isUpcoming =
            lineIdx > currentLineIndex &&
            lineIdx <= currentLineIndex + LOOKAHEAD;
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
              animate={{ opacity, y: 0 }}
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
                transition:
                  "font-size 0.6s cubic-bezier(0.25, 0.1, 0.25, 1.0), font-weight 0.6s cubic-bezier(0.25, 0.1, 0.25, 1.0)",
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

interface Turn {
  role: "user" | "assistant";
  text: string;
  partial?: boolean;
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [storyImage, setStoryImage] = useState<string | null>(null);
  const lastImageTurnRef = useRef<number>(-1);

  const sessionId = useRef(newSessionId());
  const capture = useRef<AudioCapture | null>(null);
  const tts = useRef<TTSClient | null>(null);
  const ws = useRef<WSSession | null>(null);
  const partialTurnIndex = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Fetch a contextual image based on text content
  const fetchImageForTextRef = useRef((text: string) => {
    const seed = text.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
    if (seed.length > 5) {
      setStoryImage(`https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`);
    }
  });

  useEffect(() => {
    const session = new WSSession(sessionId.current, {
      onTranscriptPartial: (text) => {
        setTurns((prev) => {
          if (partialTurnIndex.current !== null) {
            const next = [...prev];
            next[partialTurnIndex.current] = { role: "user", text, partial: true };
            return next;
          }
          partialTurnIndex.current = prev.length;
          return [...prev, { role: "user", text, partial: true }];
        });
      },

      onTranscriptFinal: (text) => {
        setTurns((prev) => {
          if (partialTurnIndex.current !== null) {
            const next = [...prev];
            next[partialTurnIndex.current] = { role: "user", text, partial: false };
            partialTurnIndex.current = null;
            return next;
          }
          return [...prev, { role: "user", text }];
        });
      },

      onLLMToken: (token) => {
        tts.current?.streamToken(token);
        setTurns((prev) => {
          if (partialTurnIndex.current !== null && prev[partialTurnIndex.current]) {
            const next = [...prev];
            const current = next[partialTurnIndex.current];
            const newText = current.text + token;
            next[partialTurnIndex.current] = {
              ...current,
              text: newText,
            };
            // Fetch image once we have ~50 chars of a new assistant turn
            if (current.role === "assistant" && newText.length > 50 && lastImageTurnRef.current !== partialTurnIndex.current) {
              lastImageTurnRef.current = partialTurnIndex.current;
              fetchImageForTextRef.current(newText);
            }
            return next;
          }
          partialTurnIndex.current = prev.length;
          lastImageTurnRef.current = -1; // reset so new turn triggers image
          return [...prev, { role: "assistant", text: token, partial: true }];
        });
      },

      onStateChange: (state) => {
        setAppState(state);
        if (state === "speaking") {
          tts.current?.flushStream();
          setTurns((prev) => {
            if (partialTurnIndex.current !== null) {
              const next = [...prev];
              next[partialTurnIndex.current] = {
                ...next[partialTurnIndex.current],
                partial: false,
              };
              partialTurnIndex.current = null;
              return next;
            }
            return prev;
          });
        }
        if (state === "idle") {
          tts.current?.flushStream();
        }
      },

      onEntities: () => {},

      onError: (msg) => {
        console.error("WS error:", msg);
        setAppState("error");
      },
    });

    session.connect();
    ws.current = session;

    tts.current = new TTSClient({
      onStart: () => setAppState("speaking"),
      onEnd: () => setAppState("idle"),
      onError: (e) => console.warn("TTS error:", e),
      onProgress: (charIndex) => {
        // Convert char position → word count in the full assistant text
        const text = assistantTextRef.current;
        if (!text) return;
        const prefix = text.slice(0, charIndex + 1);
        const wordCount = prefix.split(/\s+/).filter((w) => w.length > 0).length;
        setTotalWordsSpoken(wordCount);
      },
    });

    // Fetch briefing for story metadata (image comes when AI speaks)
    api.getBriefing(sessionId.current).then((data) => {
      if (data.stories.length > 0) {
        setCurrentStory(data.stories[0]);
      }
    }).catch(() => {});

    return () => {
      session.disconnect();
      audioCtxRef.current?.close();
    };
  }, []);

  const setupAnalyser = useCallback(async () => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      setAnalyserNode(analyser);
    } catch {}
  }, []);

  const handleMicStart = useCallback(async () => {
    if (appState === "speaking") {
      tts.current?.stop();
      ws.current?.sendInterrupt();
    }
    setAppState("listening");
    await setupAnalyser();
    if (ws.current) {
      capture.current = new AudioCapture(ws.current);
      await capture.current.start();
    }
  }, [appState, setupAnalyser]);

  const handleMicEnd = useCallback(async () => {
    await capture.current?.stop();
    capture.current = null;
    setAppState("thinking");
  }, []);

  const isListening = appState === "listening";

  const handleMicTap = useCallback(() => {
    if (appState === "thinking") return;
    if (isListening) {
      handleMicEnd();
    } else {
      handleMicStart();
    }
  }, [appState, isListening, handleMicStart, handleMicEnd]);

  // Spacebar support
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        handleMicStart();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleMicEnd();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [handleMicStart, handleMicEnd]);

  // Pick what to display based on current state
  const latestAssistant = [...turns].reverse().find((t) => t.role === "assistant");
  const latestUser = [...turns].reverse().find((t) => t.role === "user");

  // ─── Word-level teleprompter tracking (TTS-driven) ──────────────────────────
  // TTS fires onProgress(charIndex) as audio plays. We convert charIndex → word count.
  const [totalWordsSpoken, setTotalWordsSpoken] = useState(0);
  const assistantTextRef = useRef("");

  // Derive current lines from latest assistant text
  const assistantText = latestAssistant?.text || "";
  const teleLines = assistantText ? splitIntoLines(assistantText) : [];
  assistantTextRef.current = assistantText;

  let currentLine = 0;
  let currentWord = -1;
  if (totalWordsSpoken > 0 && teleLines.length > 0) {
    let remaining = totalWordsSpoken;
    for (let i = 0; i < teleLines.length; i++) {
      const wordsInLine = teleLines[i].split(" ").length;
      if (remaining <= wordsInLine) {
        currentLine = i;
        currentWord = remaining - 1;
        break;
      }
      remaining -= wordsInLine;
      if (i === teleLines.length - 1) {
        currentLine = i;
        currentWord = wordsInLine - 1;
      }
    }
  }

  // Reset when a new assistant turn begins
  useEffect(() => {
    if (turns.length === 0) return;
    const last = turns[turns.length - 1];
    if (last?.role === "assistant" && last.partial && last.text.length < 20) {
      setTotalWordsSpoken(0);
    }
  }, [turns]);

  // Determine what mode to show
  const showUserText = appState === "listening" && latestUser;
  const showTeleprompter = teleLines.length > 0 && !showUserText;

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white relative overflow-hidden font-sans">

      {/* ── Ambient blend – TOP HALF ONLY (appears when AI speaks) ── */}
      {storyImage && (
        <div className="absolute top-0 left-0 right-0 h-1/2 z-0 overflow-hidden pointer-events-none animate-fade-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={storyImage}
            alt=""
            className="w-full h-full object-cover scale-125"
          />
          <div className="absolute inset-0 z-20 bg-gradient-to-b from-transparent via-transparent via-60% to-white" />
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="flex justify-between items-center px-6 pt-12 pb-4 z-10 relative">
        <h1 className="text-sm font-bold tracking-widest text-[#1E1E1E] uppercase opacity-100">
          🦉
        </h1>
        <Link
          href="/settings"
          className="p-2 -mr-2 text-[#1E1E1E] opacity-40 hover:opacity-100 transition-opacity"
        >
          <Settings size={20} />
        </Link>
      </div>

      {/* ── Story metadata overlay ── */}
      {currentStory && (
        <div className="relative z-10 px-8 mt-auto">
          {currentStory.published && (
            <p className="text-xs font-bold uppercase tracking-wider text-[#FF8205] mb-1">
              {currentStory.published}
            </p>
          )}
          <p className="text-sm font-semibold text-[#1E1E1E]/70 leading-snug line-clamp-2">
            {currentStory.title}
          </p>
        </div>
      )}

      {/* ── Teleprompter Area ── */}
      <div className="flex-1 flex flex-col justify-center px-8 pb-24 relative z-10 overflow-hidden">
        {showUserText ? (
          <div className="relative">
            <p className="text-2xl md:text-3xl font-semibold leading-tight text-[#FF8205]">
              {latestUser!.text}
              {latestUser!.partial && (
                <span className="inline-block w-[3px] h-6 ml-1 bg-[#FF8205] animate-pulse align-middle" />
              )}
            </p>
          </div>
        ) : showTeleprompter ? (
          <LyricsTeleprompter
            lines={teleLines}
            currentLineIndex={currentLine}
            currentWordInLine={currentWord}
          />
        ) : (
          <p className="text-2xl md:text-3xl font-semibold leading-tight text-[#1E1E1E] opacity-20 text-center">
            Tap the mic and ask about today&apos;s news
          </p>
        )}
      </div>

      {/* ── Bottom Controls ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-10 flex flex-col items-center gap-6">
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-transparent -z-10" />

        {/* Pixel waveform – edge to edge */}
        <Waveform state={appState} analyserNode={analyserNode} />

        {/* Mic button */}
        <div className="relative">
          <button
            onClick={handleMicTap}
            disabled={appState === "thinking"}
            className={`w-20 h-20 rounded-full bg-[#FF8205] text-white flex items-center justify-center shadow-xl shadow-orange-500/20 active:scale-95 transition-all duration-200 hover:bg-[#FA500F] disabled:opacity-40 disabled:cursor-not-allowed ${
              isListening ? "ring-4 ring-[#FF8205]/30" : ""
            }`}
          >
            <Mic size={32} strokeWidth={2.5} />
          </button>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <p className="text-[10px] font-bold text-[#1E1E1E] opacity-30 uppercase tracking-widest">
              {isListening ? "Listening..." : "Tap to speak"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
