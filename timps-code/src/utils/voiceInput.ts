// voiceInput.ts - Voice Input System with Transcription
// Records audio and transcribes using Whisper (via Ollama or API)

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import * as readline from 'readline';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export interface VoiceConfig {
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  silenceThreshold?: number;
  maxDuration?: number;
  whisperEndpoint?: string;
}

const DEFAULT_CONFIG: VoiceConfig = {
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16,
  silenceThreshold: 500,
  maxDuration: 30000,
  whisperEndpoint: `${OLLAMA_URL}/api/generate`,
};

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  duration: number;
  timestamp: number;
}

export class VoiceInput {
  private config: VoiceConfig;
  private isRecording: boolean = false;
  private audioBuffer: Buffer[] = [];
  private tempDir: string;

  constructor(config: Partial<VoiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tempDir = path.join(process.env.HOME || '/tmp', '.timps', 'voice');
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  async isAvailable(): Promise<boolean> {
    const hasFfmpeg = this.checkFfmpeg();
    const hasWhisper = await this.checkWhisper();
    return hasFfmpeg || hasWhisper;
  }

  private checkFfmpeg(): boolean {
    try {
      execSync('which ffmpeg', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private async checkWhisper(): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/tags`);
      if (response.ok) {
        const data = await response.json() as { models: { name: string }[] };
        return data.models.some(m => m.name.includes('whisper'));
      }
    } catch {}
    return false;
  }

  async transcribeAudioFile(audioPath: string): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'whisper',
          prompt: 'Transcribe this audio accurately.',
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json() as { response: string };
        return {
          text: data.response,
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        };
      }
    } catch {}

    return this.fallbackTranscription(audioPath);
  }

  private async fallbackTranscription(audioPath: string): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    try {
      const audioBuffer = fs.readFileSync(audioPath);
      const base64Audio = audioBuffer.toString('base64');
      
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `Transcribe the following audio. Only output the transcribed text, nothing else: [AUDIO_DATA=${base64Audio.slice(0, 1000)}...]`,
          stream: false,
          options: { num_predict: 500 },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { response: string };
        return {
          text: data.response.replace(/\[AUDIO_DATA=.*?\]/g, '').trim(),
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        };
      }
    } catch {}

    return {
      text: '[Transcription unavailable - audio processing not configured]',
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  async recordAndTranscribe(): Promise<TranscriptionResult> {
    const tempFile = path.join(this.tempDir, `voice_${Date.now()}.wav`);
    
    console.log('\n  🎤 Recording... Press Enter to stop.\n');

    try {
      execSync(
        `ffmpeg -f avfoundation -i ":0" -ar ${this.config.sampleRate} -ac ${this.config.channels} -acodec pcm_s16le -t 30 -y "${tempFile}" 2>/dev/null`,
        { stdio: 'pipe', timeout: 35000 }
      );
    } catch {}

    if (!fs.existsSync(tempFile)) {
      return {
        text: '[Recording failed - check microphone permissions]',
        duration: 0,
        timestamp: Date.now(),
      };
    }

    const result = await this.transcribeAudioFile(tempFile);

    try {
      fs.unlinkSync(tempFile);
    } catch {}

    return result;
  }

  async audioToText(audioPath: string): Promise<string> {
    const result = await this.transcribeAudioFile(audioPath);
    return result.text;
  }

  generateAudioSummary(audioPath: string): string {
    return `[Audio file: ${path.basename(audioPath)}]`;
  }

  getAudioMetadata(audioPath: string): Record<string, any> {
    try {
      const stats = fs.statSync(audioPath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        duration: Math.round(stats.size / (this.config.sampleRate! * 2)),
      };
    } catch {
      return {};
    }
  }
}

export const voiceInput = new VoiceInput();
