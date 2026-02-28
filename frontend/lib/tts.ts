/**
 * tts.ts — Text-to-Speech client
 *
 * Primary:  ElevenLabs Streaming TTS via WebSocket
 * Fallback: Browser speechSynthesis API
 *
 * Usage:
 *   const tts = new TTSClient({ onStart, onEnd, onError });
 *   tts.speak("Hello, world!");      // speak full text
 *   tts.streamToken("Hello");        // feed tokens one-by-one (from LLM stream)
 *   tts.flushStream();               // flush remaining buffered tokens
 *   tts.stop();                      // interrupt immediately
 */

export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

// Sentence boundary regex — flush buffer when we hit sentence-end punctuation
const SENTENCE_END = /[.!?。]/;

// ────────────────────────────────────────────────────────────
// ElevenLabs Streaming TTS (Primary)
// ────────────────────────────────────────────────────────────

class ElevenLabsTTS {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private tokenBuffer = "";
  private callbacks: TTSCallbacks;
  private voiceId: string;
  private apiKey: string;

  constructor(callbacks: TTSCallbacks) {
    this.callbacks = callbacks;
    this.voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ?? "";
    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ?? "";
  }

  private ensureAudioCtx() {
    if (!this.audioCtx || this.audioCtx.state === "closed") {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  private async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_24000`;

    this.ws = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = () => reject(new Error("ElevenLabs WS failed to open"));
      setTimeout(() => reject(new Error("ElevenLabs WS connection timeout")), 5000);
    });

    // Send initialisation message
    this.ws.send(
      JSON.stringify({
        text: " ",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        xi_api_key: this.apiKey,
        generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
      })
    );

    this.ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data as string);
      if (msg.audio) {
        const raw = atob(msg.audio as string);
        const pcm = new Int16Array(raw.length / 2);
        for (let i = 0; i < pcm.length; i++) {
          pcm[i] = (raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8));
        }
        const audioBuf = await this._pcmToAudioBuffer(pcm);
        this.audioQueue.push(audioBuf);
        if (!this.isPlaying) this._playQueue();
      }
      if (msg.isFinal) {
        // Finished generating — wait for queue to drain
      }
    };

    this.ws.onerror = () => {
      this.callbacks.onError?.("ElevenLabs WebSocket error");
    };
  }

  private async _pcmToAudioBuffer(pcm: Int16Array): Promise<AudioBuffer> {
    this.ensureAudioCtx();
    const sampleRate = 24000;
    const buf = this.audioCtx!.createBuffer(1, pcm.length, sampleRate);
    const channelData = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) {
      channelData[i] = pcm[i] / 32768;
    }
    return buf;
  }

  private _playQueue() {
    if (!this.audioCtx || this.audioQueue.length === 0) {
      this.isPlaying = false;
      this.callbacks.onEnd?.();
      return;
    }
    this.isPlaying = true;
    const buf = this.audioQueue.shift()!;
    const source = this.audioCtx.createBufferSource();
    source.buffer = buf;
    source.connect(this.audioCtx.destination);
    source.onended = () => this._playQueue();
    source.start();
    this.callbacks.onStart?.();
  }

  /** Send a complete sentence to ElevenLabs */
  private async _sendText(text: string) {
    if (!text.trim()) return;
    await this.connect();
    this.ws?.send(JSON.stringify({ text }));
  }

  /** Buffer streaming tokens, flushing at sentence boundaries */
  streamToken(token: string) {
    this.tokenBuffer += token;
    if (SENTENCE_END.test(this.tokenBuffer)) {
      const sentence = this.tokenBuffer.trim();
      this.tokenBuffer = "";
      this._sendText(sentence);
    }
  }

  /** Flush any remaining buffered tokens */
  flushStream() {
    if (this.tokenBuffer.trim()) {
      this._sendText(this.tokenBuffer.trim());
      this.tokenBuffer = "";
    }
    // Send EOS signal
    this.ws?.send(JSON.stringify({ text: "" }));
  }

  /** Speak a complete text string */
  async speak(text: string) {
    await this._sendText(text);
    this.ws?.send(JSON.stringify({ text: "" }));
  }

  /** Interrupt playback immediately */
  stop() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.tokenBuffer = "";
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
      this.ws = null;
    }
    // Close and recreate audio context to stop any in-flight source nodes
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

// ────────────────────────────────────────────────────────────
// Browser speechSynthesis fallback
// ────────────────────────────────────────────────────────────

class BrowserTTS {
  private callbacks: TTSCallbacks;
  private tokenBuffer = "";

  constructor(callbacks: TTSCallbacks) {
    this.callbacks = callbacks;
  }

  streamToken(token: string) {
    this.tokenBuffer += token;
    if (SENTENCE_END.test(this.tokenBuffer)) {
      this._utter(this.tokenBuffer.trim());
      this.tokenBuffer = "";
    }
  }

  flushStream() {
    if (this.tokenBuffer.trim()) {
      this._utter(this.tokenBuffer.trim());
      this.tokenBuffer = "";
    }
  }

  speak(text: string) {
    this._utter(text);
  }

  private _utter(text: string) {
    if (!text) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 1.0;
    utt.onstart = () => this.callbacks.onStart?.();
    utt.onend = () => this.callbacks.onEnd?.();
    utt.onerror = () => this.callbacks.onError?.("Browser TTS error");
    window.speechSynthesis.speak(utt);
  }

  stop() {
    this.tokenBuffer = "";
    window.speechSynthesis.cancel();
  }
}

// ────────────────────────────────────────────────────────────
// TTSClient — auto-selects ElevenLabs with browser fallback
// ────────────────────────────────────────────────────────────

export class TTSClient {
  private client: ElevenLabsTTS | BrowserTTS;
  private useElevenLabs: boolean;

  constructor(callbacks: TTSCallbacks) {
    const hasElevenLabs =
      !!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY &&
      !!process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID;

    this.useElevenLabs = hasElevenLabs;
    this.client = hasElevenLabs ? new ElevenLabsTTS(callbacks) : new BrowserTTS(callbacks);
  }

  /** Feed a streaming LLM token */
  streamToken(token: string) {
    this.client.streamToken(token);
  }

  /** Flush remaining buffered tokens after LLM stream ends */
  flushStream() {
    this.client.flushStream();
  }

  /** Speak a complete pre-generated text (e.g. filler phrases) */
  async speak(text: string) {
    await this.client.speak(text);
  }

  /** Interrupt — call when user starts speaking */
  stop() {
    this.client.stop();
  }
}

// ────────────────────────────────────────────────────────────
// Filler phrase pre-generation
// ────────────────────────────────────────────────────────────

export const FILLER_PHRASES = [
  "Let me think about that...",
  "Good question, one moment...",
  "Looking that up for you...",
];

let fillerIndex = 0;
export function getFillerPhrase(): string {
  const phrase = FILLER_PHRASES[fillerIndex % FILLER_PHRASES.length];
  fillerIndex++;
  return phrase;
}
