"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Settings, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Waveform from "@/components/Waveform";
import EntityChips from "@/components/EntityChips";
import { AudioCapture } from "@/lib/stt";
import { TTSClient } from "@/lib/tts";
import { WSSession, newSessionId, api, type AppState, type Story } from "@/lib/api";

// ─── News Teleprompter ───────────────────────────────────────────────────────

const FILLER_PATTERNS = [
  /^here['']?s?\s+(the\s+)?(first|next|latest|another|a\s+quick|your)/i,
  /^let me\s+(tell|share|give|read)/i,
  /^(okay|alright|sure|so),?\s+/i,
  /^(moving|turning)\s+(on|to)\s+/i,
  /^(and\s+)?(now|next)\s+/i,
];

function isFillerSentence(s: string) {
  return FILLER_PATTERNS.some((p) => p.test(s.trim()));
}

function ScrollingTeleprompter({
  text,
  spokenCharIndex,
}: {
  text: string;
  spokenCharIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const scrollY = useRef(0);
  const rafId = useRef<number>();

  // Parse all sentences (with their original positions in the full text)
  const sentenceData = useMemo(() => {
    const raw = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    const result: { text: string; startChar: number; endChar: number }[] = [];
    let pos = 0;
    for (const s of raw) {
      const trimmed = s.trim();
      const idx = text.indexOf(s, pos);
      if (trimmed.length > 0 && !isFillerSentence(trimmed)) {
        result.push({
          text: trimmed,
          startChar: idx,
          endChar: idx + s.length,
        });
      }
      pos = idx + s.length;
    }
    return result;
  }, [text]);

  // Which sentence is currently being spoken?
  const activeSentenceIdx = useMemo(() => {
    if (spokenCharIndex <= 0) return 0;
    for (let i = sentenceData.length - 1; i >= 0; i--) {
      if (spokenCharIndex >= sentenceData[i].startChar) return i;
    }
    return 0;
  }, [spokenCharIndex, sentenceData]);

  // Slow steady scroll — ~0.15px/frame (~9px/sec, news broadcast pace)
  useEffect(() => {
    const tick = () => {
      const container = containerRef.current;
      const inner = innerRef.current;
      if (container && inner) {
        const maxScroll = inner.scrollHeight - container.clientHeight;
        if (maxScroll > 0 && scrollY.current < maxScroll) {
          scrollY.current = Math.min(scrollY.current + 0.12, maxScroll);
          container.scrollTop = scrollY.current;
        }
      }
      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
      }}
    >
      <div ref={innerRef} className="px-2" style={{ paddingTop: "65%", paddingBottom: "2rem" }}>
        {sentenceData.map((s, i) => {
          const isActive = i === activeSentenceIdx;
          const isPast = i < activeSentenceIdx;
          return (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{
                opacity: isActive ? 1 : isPast ? 0.35 : 0.2,
                y: 0,
              }}
              transition={{
                duration: 0.6,
                ease: "easeOut",
              }}
              className={`mb-5 text-[1.2rem] font-medium ${isActive ? "text-[#FF8205]" : "text-[#1E1E1E]"}`}
              style={{ lineHeight: 1.75 }}
            >
              {s.text}
            </motion.p>
          );
        })}

        {/* Reading cursor */}
        <motion.div
          className="h-[2px] w-20 bg-[#FF8205] rounded-full mt-2"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
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
  const [showSplash, setShowSplash] = useState(true);
  const [appState, setAppState] = useState<AppState>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spokenCharIndex, setSpokenCharIndex] = useState(0);

  const sessionId = useRef(newSessionId());
  const capture = useRef<AudioCapture | null>(null);
  const tts = useRef<TTSClient | null>(null);
  const ws = useRef<WSSession | null>(null);
  const partialTurnIndex = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

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
            return next;
          }
          partialTurnIndex.current = prev.length;
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

      onEntities: (newEntities) => {
        setEntities((prev) => {
          const merged = Array.from(new Set([...prev, ...newEntities]));
          return merged.slice(-8);
        });
      },

      onError: (msg) => {
        console.error("WS error:", msg);
        setErrorMessage(msg);
        setAppState("error");
        setTimeout(() => {
          setErrorMessage(null);
          setAppState("idle");
        }, 5000);
      },
    });

    session.connect();
    ws.current = session;

    tts.current = new TTSClient({
      onStart: () => setAppState("speaking"),
      onEnd: () => setAppState("idle"),
      onError: (e) => console.warn("TTS error:", e),
      onProgress: (charIndex) => setSpokenCharIndex(charIndex),
    });

    // Fetch briefing for ticker headlines
    api.getBriefing(sessionId.current).then((data) => {
      if (data.stories.length > 0) {
        setStories(data.stories.slice(0, 3));
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

  const assistantText = latestAssistant?.text || "";
  const assistantTextRef = useRef("");
  assistantTextRef.current = assistantText;

  // Reset entities when a new assistant turn begins
  useEffect(() => {
    if (turns.length === 0) return;
    const last = turns[turns.length - 1];
    if (last?.role === "assistant" && last.partial && last.text.length < 20) {
      setEntities([]);
      setSpokenCharIndex(0);
    }
  }, [turns]);

  // Determine what mode to show
  const showUserText = appState === "listening" && latestUser;
  const showTeleprompter = assistantText.length > 0 && !showUserText;

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white relative overflow-hidden font-sans">

      {/* ── Splash Screen ── */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-6xl mb-6"
            >
              🦉
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="text-3xl font-bold tracking-[0.25em] uppercase text-[#1E1E1E]"
            >
              Samvād
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="text-xs tracking-widest uppercase text-[#1E1E1E] mt-3"
            >
              Your voice-first news companion
            </motion.p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-16 h-[2px] bg-[#FF8205] mt-6 origin-center"
              onAnimationComplete={() => {
                setTimeout(() => setShowSplash(false), 800);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar ── */}
      {/* ── Top Bar ── */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-6 pt-3 pb-2 z-20">
        <div className="w-[34px] h-[34px] flex items-center justify-center">
          <span className="text-[18px] leading-none">🦉</span>
        </div>

        <Link
          href="/settings"
          className="p-2 -mr-2 text-[#1E1E1E] opacity-40 hover:opacity-100 transition-opacity"
        >
          <Settings size={18} />
        </Link>
      </div>

      {/* ── Breaking news ticker ── */}
      {stories.length > 0 && (
        <div className="absolute top-12 left-0 right-0 z-10 overflow-hidden border-y border-[#FF8205]/20 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center h-8">
            <span className="shrink-0 bg-[#FF8205] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 mr-3">
              Live
            </span>
            <div className="overflow-hidden flex-1">
              <motion.div
                className="flex whitespace-nowrap"
                animate={{ x: ["0%", "-50%"] }}
                transition={{
                  x: {
                    duration: 7,
                    repeat: Infinity,
                    ease: "linear",
                  },
                }}
              >
                {/* Duplicate the set for seamless loop */}
                {[0, 1].map((copy) => (
                  <span key={copy} className="flex items-center">
                    {stories.map((story, i) => (
                      <span key={`${copy}-${i}`} className="flex items-center">
                        <span className="text-xs font-semibold text-[#1E1E1E]/70 mr-8">
                          {story.title}
                        </span>
                        <span className="text-xs text-[#FF8205] mr-8">●</span>
                      </span>
                    ))}
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      )}

      {/* ── Teleprompter Area (between metadata and controls) ── */}
      <div className="absolute top-28 bottom-52 left-0 right-0 flex flex-col justify-center items-center px-6 z-10 overflow-hidden">
        {appState === "error" && errorMessage ? (
          <div className="text-center">
            <p className="text-lg font-semibold text-[#FA500F] mb-2">
              Something went wrong
            </p>
            <p className="text-sm text-[#1E1E1E] opacity-60">
              {errorMessage}
            </p>
            <p className="text-xs text-[#1E1E1E] opacity-40 mt-3">
              Tap the mic to try again
            </p>
          </div>
        ) : showUserText ? (
          <div className="relative">
            <p className="text-2xl md:text-3xl font-semibold leading-tight text-[#FF8205]">
              {latestUser!.text}
              {latestUser!.partial && (
                <span className="inline-block w-[3px] h-6 ml-1 bg-[#FF8205] animate-pulse align-middle" />
              )}
            </p>
          </div>
        ) : showTeleprompter ? (
          <ScrollingTeleprompter text={assistantText} spokenCharIndex={spokenCharIndex} />
        ) : (
          <p className="text-2xl md:text-3xl font-semibold leading-tight text-[#1E1E1E] opacity-40 text-center mb-32">
            🦉
          </p>
        )}
      </div>

      {/* ── Bottom Controls ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-10 flex flex-col items-center gap-6">
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-transparent -z-10" />

        {/* Entity chips */}
        {entities.length > 0 && (
          <div className="px-4 w-full">
            <EntityChips
              entities={entities}
              onTap={(entity) => {
                ws.current?.sendText(`Tell me about ${entity}`);
                setAppState("thinking");
              }}
            />
          </div>
        )}

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
