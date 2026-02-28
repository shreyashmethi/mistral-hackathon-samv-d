/**
 * api.ts — Typed HTTP client for the Samvād backend API
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export interface Story {
  title: string;
  summary: string;
  source: string;
  published?: string;
  url?: string;
}

export interface ConversationResult {
  session_id: string;
  response: string;
  intent?: string;
  entities?: string[];
  current_story_index?: number;
}

export interface BriefingResult {
  session_id: string;
  stories: Story[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; version: string }>("/api/health"),

  getBriefing: (sessionId: string) =>
    request<BriefingResult>(`/api/briefing?session_id=${sessionId}`),

  sendMessage: (sessionId: string, message: string) =>
    request<ConversationResult>("/api/conversation", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, message }),
    }),
};

// ────────────────────────────────────────────────────────────
// WebSocket session client
// ────────────────────────────────────────────────────────────

export type WSMessageType =
  | "transcript_partial"
  | "transcript_final"
  | "llm_token"
  | "state"
  | "entities"
  | "error";

export interface WSServerMessage {
  type: WSMessageType;
  data?: string;
  session_id?: string;
  extra?: Record<string, unknown>;
}

export type AppState = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface WSSessionCallbacks {
  onTranscriptPartial: (text: string) => void;
  onTranscriptFinal: (text: string) => void;
  onLLMToken: (token: string) => void;
  onStateChange: (state: AppState) => void;
  onEntities: (entities: string[]) => void;
  onError: (msg: string) => void;
}

export class WSSession {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private callbacks: WSSessionCallbacks;

  constructor(sessionId: string, callbacks: WSSessionCallbacks) {
    this.sessionId = sessionId;
    this.callbacks = callbacks;
  }

  connect() {
    this.ws = new WebSocket(`${WS_URL}/api/ws/${this.sessionId}`);

    this.ws.onmessage = (event) => {
      const msg: WSServerMessage = JSON.parse(event.data as string);
      switch (msg.type) {
        case "transcript_partial":
          this.callbacks.onTranscriptPartial(msg.data ?? "");
          break;
        case "transcript_final":
          this.callbacks.onTranscriptFinal(msg.data ?? "");
          break;
        case "llm_token":
          this.callbacks.onLLMToken(msg.data ?? "");
          break;
        case "state":
          this.callbacks.onStateChange((msg.data as AppState) ?? "idle");
          break;
        case "entities":
          this.callbacks.onEntities((msg.extra?.entities as string[]) ?? []);
          break;
        case "error":
          this.callbacks.onError(msg.data ?? "Unknown error");
          break;
      }
    };

    this.ws.onerror = () => this.callbacks.onError("WebSocket connection error");
    this.ws.onclose = () => this.callbacks.onStateChange("idle");
  }

  sendText(text: string) {
    this._send({ type: "text", data: text, session_id: this.sessionId });
  }

  sendAudioChunk(base64: string) {
    this._send({ type: "audio_chunk", data: base64, session_id: this.sessionId });
  }

  sendEndOfTurn() {
    this._send({ type: "end_of_turn", session_id: this.sessionId });
  }

  sendInterrupt() {
    this._send({ type: "interrupt", session_id: this.sessionId });
  }

  private _send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

/** Generate a random session ID */
export function newSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 11)}`;
}
