// TIMPS Gateway — Messaging Platform Integration
// Connect to Telegram, Discord, Slack, WhatsApp from a single gateway

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateId, generateRandomSecret } from './utils.js';

export type Platform = 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'signal';

export interface PlatformConfig {
  type: Platform;
  enabled: boolean;
  
  // Platform-specific config
  botToken?: string;
  apiKey?: string;
  chatId?: string;
  phoneNumber?: string;
  
  // Settings
  allowedUsers?: string[];  // User IDs allowed to talk to TIMPS
  workingDir?: string;       // Default working directory
  replyToThreads?: boolean;
}

export interface GatewayManifest {
  platforms: Record<Platform, PlatformConfig>;
  sessionSecret: string;
  defaultWorkingDir: string;
  version: string;
}

const GATEWAY_DIR = path.join(os.homedir(), '.timps', 'gateway');
const MANIFEST_FILE = path.join(GATEWAY_DIR, 'config.json');

// ── Platform Connection Logic ──

export class GatewayPlatform {
  private config: PlatformConfig;
  
  constructor(config: PlatformConfig) {
    this.config = config;
  }

  async sendMessage(text: string): Promise<boolean> {
    const { type, botToken, apiKey, chatId, phoneNumber } = this.config;

    try {
      switch (type) {
        case 'telegram':
          return await this.sendTelegram(botToken!, chatId!, text);
        
        case 'discord':
          return await this.sendDiscord(botToken!, chatId!, text);
          
        case 'slack':
          return await this.sendSlack(botToken!, chatId!, text);
          
        case 'whatsapp':
          return await this.sendWhatsApp(apiKey!, phoneNumber!, text);
          
        default:
          console.log(`[${type}] ${text}`);
          return true;
      }
    } catch (err) {
      console.error(`[${type}] Send failed:`, err);
      return false;
    }
  }

  private async sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return resp.ok;
  }

  private async sendDiscord(token: string, channelId: string, text: string): Promise<boolean> {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bot ${token}`,
      },
      body: JSON.stringify({ content: text }),
    });
    return resp.ok;
  }

  private async sendSlack(token: string, channelId: string, text: string): Promise<boolean> {
    const url = 'https://slack.com/api/chat.postMessage';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: channelId, text }),
    });
    return resp.ok;
  }

  private async sendWhatsApp(apiKey: string, phone: string, text: string): Promise<boolean> {
    const url = 'https://api.meta.whatsapp.com/v1/messages';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, text: { body: text } }),
    });
    return resp.ok;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getChatId(): string | undefined {
    return this.config.chatId;
  }
}

// ── Gateway Manager ──

export class Gateway {
  private manifest: GatewayManifest;
  private platforms: Map<Platform, GatewayPlatform> = new Map();
  private agentCallback: ((message: string, platform: Platform, userId: string) => Promise<string>) | null = null;
  private running: boolean = false;
  private httpServer: any = null;

  constructor() {
    this.manifest = this.loadManifest();
  }

  private loadManifest(): GatewayManifest {
    try {
      if (fs.existsSync(MANIFEST_FILE)) {
        return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
      }
    } catch { /* ignore */ }
    
    return {
      platforms: {
        telegram: { type: 'telegram', enabled: false },
        discord: { type: 'discord', enabled: false },
        slack: { type: 'slack', enabled: false },
        whatsapp: { type: 'whatsapp', enabled: false },
        signal: { type: 'signal', enabled: false },
      },
      sessionSecret: generateRandomSecret(32),
      defaultWorkingDir: os.homedir(),
      version: '1.0',
    };
  }

  private saveManifest(): void {
    fs.mkdirSync(GATEWAY_DIR, { recursive: true });
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(this.manifest, null, 2), 'utf-8');
  }

  // Set the agent callback
  onMessage(callback: (message: string, platform: Platform, userId: string) => Promise<string>): void {
    this.agentCallback = callback;
  }

  // List platforms
  listPlatforms(): { type: Platform; enabled: boolean; config: PlatformConfig }[] {
    return Object.values(this.manifest.platforms).map(p => ({
      type: p.type,
      enabled: p.enabled,
      config: p,
    }));
  }

  // Configure a platform
  configure(platform: Platform, config: Partial<PlatformConfig>): boolean {
    if (!this.manifest.platforms[platform]) return false;
    
    Object.assign(this.manifest.platforms[platform], config);
    this.saveManifest();
    
    if (config.enabled) {
      this.platforms.set(platform, new GatewayPlatform(this.manifest.platforms[platform]));
    } else {
      this.platforms.delete(platform);
    }
    
    return true;
  }

  // Send message to all enabled platforms
  async broadcast(text: string): Promise<Record<Platform, boolean>> {
    const results: Record<Platform, boolean> = {} as any;
    
    for (const [type, platform] of this.platforms) {
      const success = await platform.sendMessage(text);
      results[type] = success;
    }
    
    return results;
  }

  // Handle incoming message
  async handleMessage(platform: Platform, userId: string, message: string): Promise<string> {
    const config = this.manifest.platforms[platform];
    
    // Check allowed users
    if (config.allowedUsers?.length && !config.allowedUsers.includes(userId)) {
      return 'You are not authorized to use TIMPS. Contact the admin.';
    }

    // Call the agent
    if (this.agentCallback) {
      return await this.agentCallback(message, platform, userId);
    }
    
    return 'TIMPS Gateway is running but no agent is connected.';
  }

  // Start polling/ws for each platform
  async start(): Promise<void> {
    this.running = true;
    
    for (const [type, config] of Object.entries(this.manifest.platforms)) {
      if (!config.enabled || !config.botToken) continue;
      
      this.platforms.set(type as Platform, new GatewayPlatform(config));
      
      switch (type) {
        case 'telegram':
          this.startTelegramPolling(config.botToken!, config.allowedUsers?.[0]);
          break;
        case 'discord':
          this.startDiscordGateway(config.botToken!);
          break;
      }
    }
    
    console.log(`Gateway started with ${this.platforms.size} platforms`);
  }

  // Simple Telegram polling
  private startTelegramPolling(token: string, allowedUser?: string): void {
    let offset = 0;
    
    const poll = async () => {
      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=60&offset=${offset}`;
        const resp = await fetch(url);
        const data = await resp.json();
        
        for (const update of data.result || []) {
          offset = update.update_id + 1;
          
          const msg = update.message?.text;
          const userId = String(update.message?.from?.id);
          
          if (msg && this.agentCallback) {
            const response = await this.agentCallback(msg, 'telegram', userId);
            
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                chat_id: update.message?.chat?.id, 
                text: response,
              }),
            });
          }
        }
      } catch { /* ignore */ }
      
      if (this.running) setTimeout(poll, 1000);
    };
    
    poll();
  }

  // Discord Gateway (simplified)
  private startDiscordGateway(token: string): void {
    console.log('[Gateway] Discord polling not implemented yet (use webhooks instead)');
  }

  // Stop gateway
  async stop(): Promise<void> {
    this.running = false;
    this.platforms.clear();
    console.log('[Gateway] Stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getSecret(): string {
    return this.manifest.sessionSecret;
  }
}

export const gateway = new Gateway();

// ── Gateway CLI helpers ──

export async function handleGatewayCommand(args: string[]): Promise<string> {
  if (args[0] === 'list' || !args[0]) {
    const platforms = gateway.listPlatforms();
    return 'Platforms:\n' + platforms.map(p => 
      `  ${p.enabled ? '✓' : '○'} ${p.type}`
    ).join('\n');
  }

  if (args[0] === 'setup' && args[1]) {
    const platform = args[1] as Platform;
    
    if (args[1] === 'telegram') {
      const token = args[2] || process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return 'Telegram bot token required: timps gateway setup telegram <token>';
      
      gateway.configure('telegram', { type: 'telegram', enabled: true, botToken: token });
      return 'Telegram configured. Run: timps gateway start';
    }
    
    if (args[1] === 'discord') {
      const token = args[2] || process.env.DISCORD_BOT_TOKEN;
      if (!token) return 'Discord bot token required: timps gateway setup discord <token>';
      
      gateway.configure('discord', { type: 'discord', enabled: true, botToken: token });
      return 'Discord configured. Run: timps gateway start';
    }
    
    return `Supported platforms: telegram, discord, slack, whatsapp`;
  }

  if (args[0] === 'start') {
    await gateway.start();
    return 'Gateway started!';
  }

  if (args[0] === 'stop') {
    await gateway.stop();
    return 'Gateway stopped.';
  }

  return `Usage: timps gateway <list|setup|start|stop>`;
}