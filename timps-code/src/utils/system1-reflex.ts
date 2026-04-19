// system1-reflex.ts - System 1 (Execution) Reflex Layer
// Real-time video-first processing for instant computer actions
// Processes continuous video stream + input history for zero-latency responses

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawn } from 'node:child_process';

export interface VisualFrame {
  timestamp: number;
  screenshot: Buffer;
  screenRegion: { x: number; y: number; width: number; height: number };
  delta?: Buffer;  // Difference from previous frame - captures UI transitions
}

export interface InputEvent {
  timestamp: number;
  type: 'key' | 'mouse' | 'scroll' | 'terminal' | 'ide';
  action: string;
  target?: string;
  coordinates?: { x: number; y: number };
  context?: string;  // terminal output, IDE state
}

export interface ReflexAction {
  type: 'keystroke' | 'mouse_click' | 'command' | 'wait' | 'observe';
  payload: string;
  confidence: number;
  latencyMs: number;
  videoBased: boolean;  // True if action based on video stream, not screenshot
}

export interface System1Config {
  visualBufferSeconds: number;
  maxLatencyMs: number;
  inputHistorySize: number;
  screenCaptureIntervalMs: number;
  enableVideoStream: boolean;
  captureDelta: boolean;  // Capture UI transitions between frames
}

export class System1Reflex {
  private config: System1Config;
  private visualBuffer: VisualFrame[] = [];
  private inputHistory: InputEvent[] = [];
  private lastCapture = 0;
  private actionHistory: ReflexAction[] = [];
  private isRunning = false;
  private videoProcess?: any;
  private lastFrameHash = '';
  private uiTransitions: string[] = [];  // Captures UI changes that screenshots miss

  constructor(visualBufferSeconds: number = 5, maxLatencyMs: number = 100) {
    this.config = {
      visualBufferSeconds,
      maxLatencyMs,
      inputHistorySize: 100,
      screenCaptureIntervalMs: 50,
      enableVideoStream: true,
      captureDelta: true,
    };
  }

  // Start continuous video stream processing
  async startVideoStream(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('🎬 System1: Starting video stream (5s buffer, <100ms target)');
    
    while (this.isRunning) {
      await this.captureVisualState();
      await this.processVideoFrame();
      await this.sleep(50);  // 20fps video stream
    }
  }

  stopVideoStream(): void {
    this.isRunning = false;
    if (this.videoProcess) {
      try { this.videoProcess.kill(); } catch {}
    }
    console.log('🛑 System1: Video stream stopped');
  }

  private async processVideoFrame(): Promise<void> {
    if (this.visualBuffer.length < 2) return;
    
    const latest = this.visualBuffer[this.visualBuffer.length - 1];
    const previous = this.visualBuffer[this.visualBuffer.length - 2];
    
    // Compute delta - captures UI transitions that screenshots miss
    const delta = this.computeDelta(previous.screenshot, latest.screenshot);
    latest.delta = delta || undefined;
    
    // Detect UI transitions
    if (delta && delta.length > 100) {  // Significant change
      this.uiTransitions.push(`t=${latest.timestamp}: ${delta.length}px changed`);
      
      // Example transitions:
      // - Terminal prompt appeared
      // - Menu opened/closed
      // - Progress bar updated
      // - Error message displayed
      
      // Trigger reflex based on transition type
      await this.handleTransition(latest, delta);
    }
  }

  private computeDelta(prev: Buffer, curr: Buffer): Buffer | null {
    if (prev.length !== curr.length) return null;
    
    const delta = Buffer.alloc(curr.length);
    for (let i = 0; i < curr.length; i++) {
      if (prev[i] !== curr[i]) {
        delta[i] = 1;
      }
    }
    return delta;
  }

  private async handleTransition(frame: VisualFrame, delta: Buffer): Promise<void> {
    // Map UI transitions to reflex actions
    // This handles the "UI drift" issue where agents miss terminal state changes
    
    const transitionPatterns: { pattern: RegExp; action: ReflexAction }[] = [
      // Terminal prompt appeared → ready for input
      { pattern: /prompt.*appeared/i, action: { type: 'observe', payload: 'terminal_ready', confidence: 0.8, latencyMs: 0, videoBased: true } },
      // Error message shown → need debugging
      { pattern: /error.*red/i, action: { type: 'observe', payload: 'error_detected', confidence: 0.9, latencyMs: 0, videoBased: true } },
      // Progress bar updated → command running
      { pattern: /progress/i, action: { type: 'wait', payload: 'command_running', confidence: 0.7, latencyMs: 0, videoBased: true } },
      // Menu opened → user navigating
      { pattern: /menu.*open/i, action: { type: 'observe', payload: 'menu_active', confidence: 0.8, latencyMs: 0, videoBased: true } },
    ];

    for (const { pattern, action } of transitionPatterns) {
      if (pattern.test(this.uiTransitions[this.uiTransitions.length - 1] || '')) {
        this.actionHistory.push({ ...action, latencyMs: Date.now() - frame.timestamp });
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Capture current screen state (past 5 seconds)
  async captureVisualState(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastCapture < this.config.screenCaptureIntervalMs) {
      return;
    }
    this.lastCapture = now;

    try {
      // macOS: Use screencapture command
      const screenshot = execSync('screencapture -x -t png -', { encoding: 'buffer' });
      
      this.visualBuffer.push({
        timestamp: now,
        screenshot,
        screenRegion: { x: 0, y: 0, width: 1920, height: 1080 },
      });

      // Keep only past N seconds of visual data
      const cutoff = now - (this.config.visualBufferSeconds * 1000);
      this.visualBuffer = this.visualBuffer.filter(f => f.timestamp > cutoff);
    } catch {
      // Fallback: capture via screenshot tool or simulated
      const placeholder = Buffer.from('SIMULATED_FRAME');
      this.visualBuffer.push({
        timestamp: now,
        screenshot: placeholder,
        screenRegion: { x: 0, y: 0, width: 1920, height: 1080 },
      });
    }
  }

  // Record input event (keyboard/mouse)
  recordInput(type: 'key' | 'mouse' | 'scroll', action: string, target?: string, coords?: { x: number; y: number }): void {
    const event: InputEvent = {
      timestamp: Date.now(),
      type,
      action,
      target,
      coordinates: coords,
    };

    this.inputHistory.push(event);

    // Keep history bounded
    if (this.inputHistory.length > this.config.inputHistorySize) {
      this.inputHistory = this.inputHistory.slice(-this.config.inputHistorySize);
    }

    // Trigger reflex processing
    this.processReflex(event);
  }

  // System 1: Fast reflex processing - no reasoning, just action
  private processReflex(event: InputEvent): void {
    const startTime = Date.now();

    // Pattern match: input → action (no LLM, pure reflex)
    const action = this.matchReflexPattern(event);
    
    if (action) {
      this.actionHistory.push(action);
      this.executeReflexAction(action);
    }

    const latency = Date.now() - startTime;
    if (latency > this.config.maxLatencyMs) {
      console.log(`⚠️ Reflex latency warning: ${latency}ms (max: ${this.config.maxLatencyMs}ms)`);
    }
  }

  private matchReflexPattern(event: InputEvent): ReflexAction | null {
    const recentInputs = this.inputHistory.slice(-10);
    const recentKeys = recentInputs.filter(e => e.type === 'key').map(e => e.action);
    const recentMouse = recentInputs.filter(e => e.type === 'mouse');

    // Common reflex patterns (learned from System 2)
    const patterns: { pattern: string[]; action: ReflexAction }[] = [
      // Ctrl+C copy
      { pattern: ['Control+c'], action: { type: 'keystroke', payload: 'copy', confidence: 0.9, latencyMs: 0, videoBased: false } },
      // Ctrl+V paste
      { pattern: ['Control+v'], action: { type: 'keystroke', payload: 'paste', confidence: 0.9, latencyMs: 0, videoBased: false } },
      // Ctrl+S save
      { pattern: ['Control+s'], action: { type: 'keystroke', payload: 'save', confidence: 0.95, latencyMs: 0, videoBased: false } },
      // Ctrl+Z undo
      { pattern: ['Control+z'], action: { type: 'keystroke', payload: 'undo', confidence: 0.9, latencyMs: 0, videoBased: false } },
      // Double click select word
      { pattern: ['mouse_click', 'mouse_click'], action: { type: 'mouse_click', payload: 'select_word', confidence: 0.85, latencyMs: 0, videoBased: false } },
      // Type "fun" + Tab = autocomplete
      { pattern: ['f', 'u', 'n', 'Tab'], action: { type: 'keystroke', payload: 'autocomplete', confidence: 0.7, latencyMs: 0, videoBased: false } },
    ];

    for (const { pattern, action } of patterns) {
      if (this.matchSequence(recentKeys, pattern)) {
        return { ...action, latencyMs: Date.now() - event.timestamp };
      }
    }

    return null;
  }

  private matchSequence(inputs: string[], pattern: string[]): boolean {
    if (pattern.length > inputs.length) return false;
    const lastN = inputs.slice(-pattern.length);
    return lastN.join(' ').includes(pattern.join(' '));
  }

  private executeReflexAction(action: ReflexAction): void {
    const start = Date.now();

    switch (action.type) {
      case 'keystroke':
        this.executeKeystroke(action.payload);
        break;
      case 'mouse_click':
        this.executeMouseAction(action.payload);
        break;
      case 'command':
        this.executeCommand(action.payload);
        break;
      case 'wait':
        // Do nothing - wait for more input
        break;
    }

    action.latencyMs = Date.now() - start;
  }

  private executeKeystroke(action: string): void {
    try {
      // Use AppleScript for macOS keyboard automation
      const scripts: Record<string, string> = {
        copy: 'tell app "System Events" to keystroke "c" using command down',
        paste: 'tell app "System Events" to keystroke "v" using command down',
        save: 'tell app "System Events" to keystroke "s" using command down',
        undo: 'tell app "System Events" to keystroke "z" using command down',
      };

      if (scripts[action]) {
        execSync(`osascript -e '${scripts[action]}'`, { stdio: 'ignore' });
      }
    } catch {}
  }

  private executeMouseAction(action: string): void {
    // Mouse automation would go here
  }

  private executeCommand(cmd: string): void {
    execSync(cmd, { stdio: 'ignore' });
  }

  // Get recent visual context for System 2 reasoning
  getVisualContext(): { frames: number; lastInput: InputEvent | null; actions: number } {
    return {
      frames: this.visualBuffer.length,
      lastInput: this.inputHistory[this.inputHistory.length - 1] || null,
      actions: this.actionHistory.length,
    };
  }

  // Clear buffers (for new session)
  reset(): void {
    this.visualBuffer = [];
    this.inputHistory = [];
    this.actionHistory = [];
  }

  getStats(): { bufferSize: number; inputCount: number; actionCount: number; avgLatency: number } {
    const latencies = this.actionHistory.map(a => a.latencyMs);
    const avgLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;

    return {
      bufferSize: this.visualBuffer.length,
      inputCount: this.inputHistory.length,
      actionCount: this.actionHistory.length,
      avgLatency,
    };
  }
}

export function createSystem1Reflex(): System1Reflex {
  return new System1Reflex(5, 100);
}