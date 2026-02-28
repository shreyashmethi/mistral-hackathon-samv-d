"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MicButton from "@/components/MicButton";
import Transcript, { type Turn } from "@/components/Transcript";
import Waveform from "@/components/Waveform";
import EntityChips from "@/components/EntityChips";
import StatusBar from "@/components/StatusBar";
import { STTClient } from "@/lib/stt";
import { TTSClient, getFillerPhrase } from "@/lib/tts";
import { WSSession, newSessionId, api, type AppState } from "@/lib/api";

// ── State ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [storyIndex, setStoryIndex] = useState(0);
  const [totalStories, setTotalStories] = useState(0);
  const [textInput, setTextInput] = useState("");
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // Refs for mutable things that don't need re-renders
  const sessionId = useRef(newSessionId());
  const stt = useRef<STTClient | null>(null);
  const tts = useRef<TTSClient | null>(null);
  const ws = useRef<WSSession | null>(null);
  const partialTurnIndex = useRef<number | null>(null); // index of in-progress AI turn
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // ── WebSocket session setup ──────────────────────────────────────────────────

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
        // Play token through TTS
        tts.current?.streamToken(token);

        // Append to AI turn in transcript
        setTurns((prev) => {
          if (partialTurnIndex.current !== null) {
            const next = [...prev];
            const current = next[partialTurnIndex.current];
            next[partialTurnIndex.current] = {
              ...current,
              text: current.text + token,
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
          // LLM done streaming — flush TTS buffer
          tts.current?.flushStream();
          // Finalise assistant turn
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
          const merged = [...prev];
          for (const e of newEntities) {
            if (!merged.includes(e)) merged.push(e);
          }
          return merged.slice(-8); // keep last 8
        });
      },

      onError: (msg) => {
        console.error("WS error:", msg);
        setAppState("error");
      },
    });

    session.connect();
    ws.current = session;

    // Init TTS
    tts.current = new TTSClient({
      onStart: () => setAppState("speaking"),
      onEnd: () => setAppState("idle"),
      onError: (e) => console.warn("TTS error:", e),
    });

    // Fetch initial briefing
    api.getBriefing(sessionId.current).then((data) => {
      setTotalStories(data.stories.length);
    }).catch(() => {
      // Backend not up yet — fine in dev
    });

    return () => {
      session.disconnect();
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Audio analyser for waveform ──────────────────────────────────────────────

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
      analyserRef.current = analyser;
      setAnalyserNode(analyser);
    } catch {
      // Mic permission denied — waveform won't show live data, that's ok
    }
  }, []);

  // ── Push-to-talk handlers ────────────────────────────────────────────────────

  const handleMicStart = useCallback(async () => {
    // Interrupt if AI is speaking
    if (appState === "speaking") {
      tts.current?.stop();
      ws.current?.sendInterrupt();
    }

    setAppState("listening");
    await setupAnalyser();

    stt.current = new STTClient({
      onPartial: (text) => ws.current?.sendText("__partial:" + text), // for local display only
      onFinal: (text) => {
        setTurns((prev) => [...prev, { role: "user", text }]);
        ws.current?.sendText(text);
        // Play filler while waiting
        tts.current?.speak(getFillerPhrase());
      },
      onError: (err) => {
        console.warn("STT error:", err);
        setAppState("error");
      },
      onStateChange: (state) => {
        if (state === "listening") setAppState("listening");
      },
    });

    await stt.current.start();
  }, [appState, setupAnalyser]);

  const handleMicEnd = useCallback(async () => {
    await stt.current?.stop();
    setAppState("thinking");
  }, []);

  // ── Entity chip tap ──────────────────────────────────────────────────────────

  const handleEntityTap = useCallback((entity: string) => {
    const question = `What is ${entity}?`;
    setTurns((prev) => [...prev, { role: "user", text: question }]);
    ws.current?.sendText(question);
    tts.current?.speak(getFillerPhrase());
    setAppState("thinking");
  }, []);

  // ── Text input (fallback) ────────────────────────────────────────────────────

  const handleTextSubmit = useCallback(() => {
    const msg = textInput.trim();
    if (!msg) return;
    setTextInput("");
    setTurns((prev) => [...prev, { role: "user", text: msg }]);
    ws.current?.sendText(msg);
    tts.current?.speak(getFillerPhrase());
    setAppState("thinking");
  }, [textInput]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="flex flex-col h-screen max-w-lg mx-auto">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-samvad-surface border-b border-samvad-border">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Samvād</h1>
          <p className="text-[10px] text-samvad-muted">AI News Companion</p>
        </div>
        <StatusBar state={appState} storyIndex={storyIndex} totalStories={totalStories} />
      </header>

      {/* Waveform */}
      <div className="px-4 pt-3">
        <Waveform state={appState} analyserNode={analyserNode} />
      </div>

      {/* Transcript — scrollable */}
      <Transcript turns={turns} />

      {/* Entity chips */}
      <EntityChips entities={entities} onTap={handleEntityTap} />

      {/* Bottom: mic + text input */}
      <div className="border-t border-samvad-border bg-samvad-surface px-4 py-4">
        <div className="flex items-end gap-3">
          {/* Text fallback input */}
          <div className="flex-1 flex items-center gap-2 bg-samvad-bg border border-samvad-border rounded-full px-4 py-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
              placeholder="Or type here…"
              className="flex-1 bg-transparent text-sm text-samvad-text placeholder-samvad-muted outline-none"
            />
            {textInput && (
              <button
                onClick={handleTextSubmit}
                className="text-samvad-accent text-xs font-medium hover:text-white transition-colors"
              >
                Send
              </button>
            )}
          </div>

          {/* Main mic button */}
          <MicButton
            state={appState}
            onPressStart={handleMicStart}
            onPressEnd={handleMicEnd}
            disabled={appState === "thinking"}
          />
        </div>
      </div>
    </main>
  );
}
