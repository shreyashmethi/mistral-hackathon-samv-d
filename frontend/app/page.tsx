"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Settings, Mic } from "lucide-react";
import Waveform from "@/components/Waveform";
import { AudioCapture } from "@/lib/stt";
import { TTSClient } from "@/lib/tts";
import { WSSession, newSessionId, api, type AppState, type Story } from "@/lib/api";

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

  // Extract only the current (last) sentence from text
  const getLastSentence = (text: string): string => {
    if (!text) return "";
    // Split into sentences at boundaries
    const parts = text.split(/(?<=[.!?])\s+/);
    // Return the last part (current sentence being spoken)
    const last = parts[parts.length - 1];
    return last || text;
  };

  let displayText: string | null = null;
  let isPartial = false;
  let isUserSpeaking = false;

  if (appState === "listening" && latestUser) {
    // Show what user is saying
    displayText = latestUser.text;
    isPartial = !!latestUser.partial;
    isUserSpeaking = true;
  } else if ((appState === "thinking" || appState === "speaking") && latestAssistant) {
    // Show current AI sentence
    displayText = getLastSentence(latestAssistant.text);
    isPartial = !!latestAssistant.partial;
  } else if (appState === "idle" && latestAssistant) {
    // Show last AI sentence when idle
    displayText = getLastSentence(latestAssistant.text);
  }

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
        <h1 className="text-sm font-bold tracking-widest text-[#1E1E1E] uppercase opacity-40">
          Samvād Live
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
      <div className="flex-1 flex flex-col justify-center px-8 pb-24 mt-[-60px] relative z-10">
        {!displayText ? (
          <p className="text-2xl md:text-3xl font-semibold leading-tight text-[#1E1E1E] opacity-20 text-center">
            Tap the mic and ask about today&apos;s news
          </p>
        ) : (
          <div className="relative">
            <p className={`text-2xl md:text-3xl font-semibold leading-tight ${
              isUserSpeaking ? "text-[#FF8205]" : "text-[#1E1E1E]"
            }`}>
              {displayText}
              {isPartial && (
                <span className="inline-block w-[3px] h-6 ml-1 bg-[#FF8205] animate-pulse align-middle" />
              )}
            </p>
          </div>
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
