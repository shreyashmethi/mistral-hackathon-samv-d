/**
 * stt.ts — Speech-to-Text client
 *
 * Primary:  Pixtral Real-Time STT via WebSocket
 * Fallback: Browser Web Speech API (SpeechRecognition)
 *
 * Usage:
 *   const stt = new STTClient({ onPartial, onFinal, onError });
 *   await stt.start();   // begins listening
 *   await stt.stop();    // stops + triggers onFinal with complete transcript
 */

export interface STTCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: string) => void;
  onStateChange?: (state: "idle" | "listening" | "processing") => void;
}

// ────────────────────────────────────────────────────────────
// Pixtral Real-Time STT (Primary)
// ────────────────────────────────────────────────────────────

class PixtralSTT {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private callbacks: STTCallbacks;

  constructor(callbacks: STTCallbacks) {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    const wsUrl = process.env.NEXT_PUBLIC_PIXTRAL_WS_URL;
    if (!wsUrl) throw new Error("NEXT_PUBLIC_PIXTRAL_WS_URL not set");

    // Get microphone
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Connect WebSocket
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.callbacks.onStateChange?.("listening");
      this._startRecording();
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      if (msg.type === "partial") {
        this.callbacks.onPartial(msg.text ?? "");
      } else if (msg.type === "final") {
        this.callbacks.onFinal(msg.text ?? "");
      }
    };

    this.ws.onerror = (err) => {
      this.callbacks.onError("Pixtral STT WebSocket error");
      console.error("Pixtral STT WS error", err);
    };

    this.ws.onclose = () => {
      this.callbacks.onStateChange?.("idle");
    };
  }

  private _startRecording() {
    if (!this.stream || !this.ws) return;

    // Use opus audio for Pixtral if supported, else webm
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = async (e) => {
      if (e.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        // Convert blob → ArrayBuffer → send binary
        const buf = await e.data.arrayBuffer();
        this.ws.send(buf);
      }
    };

    // Emit chunks every 250ms for near-real-time streaming
    this.mediaRecorder.start(250);
  }

  async stop(): Promise<void> {
    this.mediaRecorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());

    if (this.ws?.readyState === WebSocket.OPEN) {
      // Signal end of audio so Pixtral flushes final transcript
      this.ws.send(JSON.stringify({ type: "end_of_audio" }));
      // Give it a moment to return final result before closing
      await new Promise((r) => setTimeout(r, 500));
      this.ws.close();
    }

    this.ws = null;
    this.mediaRecorder = null;
    this.stream = null;
    this.callbacks.onStateChange?.("idle");
  }
}

// ────────────────────────────────────────────────────────────
// Browser Web Speech API (Fallback)
// ────────────────────────────────────────────────────────────

class BrowserSTT {
  private recognition: SpeechRecognition | null = null;
  private callbacks: STTCallbacks;
  private finalTranscript = "";

  constructor(callbacks: STTCallbacks) {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Browser Speech Recognition not supported");
    }

    this.finalTranscript = "";
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          this.finalTranscript += result[0].transcript + " ";
          this.callbacks.onFinal(this.finalTranscript.trim());
        } else {
          interim += result[0].transcript;
          this.callbacks.onPartial(this.finalTranscript + interim);
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.callbacks.onError(`Speech recognition error: ${event.error}`);
    };

    this.recognition.onend = () => {
      this.callbacks.onStateChange?.("idle");
    };

    this.recognition.start();
    this.callbacks.onStateChange?.("listening");
  }

  async stop(): Promise<void> {
    this.recognition?.stop();
    this.recognition = null;
  }
}

// ────────────────────────────────────────────────────────────
// STTClient — auto-selects Pixtral with browser fallback
// ────────────────────────────────────────────────────────────

export class STTClient {
  private client: PixtralSTT | BrowserSTT | null = null;
  private callbacks: STTCallbacks;
  private usePixtral: boolean;

  constructor(callbacks: STTCallbacks) {
    this.callbacks = callbacks;
    // Use Pixtral if WS URL is configured, else browser
    this.usePixtral = !!process.env.NEXT_PUBLIC_PIXTRAL_WS_URL;
  }

  async start(): Promise<void> {
    if (this.usePixtral) {
      try {
        this.client = new PixtralSTT(this.callbacks);
        await this.client.start();
        return;
      } catch (err) {
        console.warn("Pixtral STT failed, falling back to browser STT:", err);
        this.usePixtral = false;
      }
    }
    this.client = new BrowserSTT(this.callbacks);
    await this.client.start();
  }

  async stop(): Promise<void> {
    await this.client?.stop();
    this.client = null;
  }
}
