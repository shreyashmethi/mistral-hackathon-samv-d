/**
 * stt.ts — Audio capture for backend Voxtral STT.
 *
 * Captures mic audio, resamples to PCM s16le 16kHz mono,
 * and sends base64-encoded chunks to the backend via WebSocket.
 * The backend handles transcription via Voxtral Realtime API
 * and sends back transcript_partial / transcript_final messages.
 *
 * Usage:
 *   const capture = new AudioCapture(ws);
 *   await capture.start();   // begins recording + streaming
 *   await capture.stop();    // stops + sends end_of_turn
 */

import type { WSSession } from "./api";

const TARGET_SAMPLE_RATE = 16000;

export class AudioCapture {
  private ws: WSSession;
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private recording = false;

  constructor(ws: WSSession) {
    this.ws = ws;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const nativeSampleRate =
      this.stream.getAudioTracks()[0].getSettings().sampleRate || 44100;
    this.audioCtx = new AudioContext({ sampleRate: nativeSampleRate });
    const source = this.audioCtx.createMediaStreamSource(this.stream);

    const bufferSize = 4096;
    this.processorNode = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);

    this.processorNode.onaudioprocess = (e) => {
      if (!this.recording) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const sourceSampleRate = this.audioCtx!.sampleRate;

      // Resample to 16kHz
      const resampled = resample(inputData, sourceSampleRate, TARGET_SAMPLE_RATE);

      // Convert float32 → int16 PCM (s16le)
      const pcm = float32ToInt16(resampled);

      // Send as base64 via the existing WebSocket audio_chunk message
      const base64 = arrayBufferToBase64(pcm.buffer as ArrayBuffer);
      this.ws.sendAudioChunk(base64);
    };

    source.connect(this.processorNode);
    this.processorNode.connect(this.audioCtx.destination);

    this.recording = true;
  }

  async stop(): Promise<void> {
    this.recording = false;

    this.processorNode?.disconnect();
    this.processorNode = null;

    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      await this.audioCtx.close();
    }
    this.audioCtx = null;

    // Signal end of audio to backend — backend finalizes STT and triggers LLM
    this.ws.sendEndOfTurn();
  }
}

// ── Helpers ──────────────────────────────────────────────────

function resample(
  input: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const floor = Math.floor(srcIndex);
    const ceil = Math.min(floor + 1, input.length - 1);
    const frac = srcIndex - floor;
    output[i] = input[floor] * (1 - frac) + input[ceil] * frac;
  }
  return output;
}

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
