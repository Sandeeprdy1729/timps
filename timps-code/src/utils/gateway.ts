// TIMPS Gateway — Messaging Platform Integration
// Connect to Telegram, Discord, Slack, WhatsApp, Feishu, DingTalk,
// WPS Xiezuo, Weibo, WeChat Work, Weixin (personal), QQ, QQ Bot, LINE
// and more — all from a single unified gateway.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateId, generateRandomSecret } from './utils.js';

// ── Platform registry ──────────────────────────────────────────────────────
// 5 original platforms + 9 cc-connect platforms = 14 total

export type Platform =
  // Original platforms
  | 'telegram'      // Long polling — no public IP needed
  | 'discord'       // Gateway — no public IP needed
  | 'slack'         // Socket Mode — no public IP needed
  | 'whatsapp'      // Meta Cloud API — webhook
  | 'signal'        // Signal-CLI REST bridge
  // cc-connect platforms (https://github.com/chenhg5/cc-connect)
  | 'feishu'        // Feishu/Lark — WebSocket, no public IP
  | 'lark'          // Lark (international) — WebSocket, no public IP
  | 'dingtalk'      // DingTalk — Stream, no public IP
  | 'wps-xiezuo'   // WPS Xiezuo — WebSocket, no public IP
  | 'weibo'         // Weibo DM — WebSocket, no public IP
  | 'wecom'         // WeChat Work — WebSocket/Webhook
  | 'weixin'        // Weixin personal (ilink) — HTTP long polling, no public IP
  | 'qq'            // QQ via NapCat/OneBot — WebSocket
  | 'qqbot'         // QQ Bot Official — WebSocket, no public IP
  | 'line';         // LINE — Webhook (public URL required)

export interface PlatformConfig {
  type: Platform;
  enabled: boolean;

  // ── Generic credentials ──────────────────────────────────────────────────
  botToken?: string;      // Telegram / Discord / QQ Bot
  apiKey?: string;        // WhatsApp / generic
  chatId?: string;        // Telegram chat / Feishu chat / WeCom open_id
  phoneNumber?: string;   // WhatsApp to-number

  // ── Feishu / Lark ────────────────────────────────────────────────────────
  feishuAppId?: string;
  feishuAppSecret?: string;
  feishuDomain?: string;  // override for Lark international; default: feishu

  // ── DingTalk ──────────────────────────────────────────────────────────────
  dingClientId?: string;
  dingClientSecret?: string;
  dingRobotCode?: string;

  // ── WPS Xiezuo ────────────────────────────────────────────────────────────
  wpsAppId?: string;
  wpsAppSecret?: string;

  // ── Weibo ─────────────────────────────────────────────────────────────────
  weiboAccessToken?: string;
  weiboUid?: string;        // recipient UID for DMs

  // ── WeChat Work (WeCom) ───────────────────────────────────────────────────
  wecomCorpId?: string;
  wecomCorpSecret?: string;
  wecomAgentId?: number;

  // ── Weixin personal (ilink) ───────────────────────────────────────────────
  weixinToken?: string;     // ilink session token
  weixinContextToken?: string;

  // ── QQ (NapCat / OneBot v11) ─────────────────────────────────────────────
  qqHttpUrl?: string;       // e.g. http://127.0.0.1:3000
  qqWsUrl?: string;         // e.g. ws://127.0.0.1:3001
  qqSelfId?: string;        // QQ number of the bot
  qqGroupId?: string;       // optional default group

  // ── QQ Bot Official ───────────────────────────────────────────────────────
  qqbotAppId?: string;
  qqbotClientSecret?: string;
  qqbotGuildId?: string;   // optional default guild (server) ID

  // ── LINE ──────────────────────────────────────────────────────────────────
  lineChannelAccessToken?: string;
  lineChannelSecret?: string;
  lineWebhookPort?: number; // local port for webhook server; default 8080

  // ── Shared settings ───────────────────────────────────────────────────────
  allowedUsers?: string[];   // User IDs allowed to talk to TIMPS
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
    const cfg = this.config;
    const { type } = cfg;

    try {
      switch (type) {
        // ── Original platforms ─────────────────────────────────────────────
        case 'telegram':
          return await this.sendTelegram(cfg.botToken!, cfg.chatId!, text);

        case 'discord':
          return await this.sendDiscord(cfg.botToken!, cfg.chatId!, text);

        case 'slack':
          return await this.sendSlack(cfg.botToken!, cfg.chatId!, text);

        case 'whatsapp':
          return await this.sendWhatsApp(cfg.apiKey!, cfg.phoneNumber!, text);

        case 'signal':
          // Signal-CLI REST bridge: POST /v2/send
          return await this.sendSignal(cfg.apiKey!, cfg.phoneNumber!, cfg.chatId!, text);

        // ── cc-connect platforms ───────────────────────────────────────────
        case 'feishu':
        case 'lark': {
          const domain = cfg.feishuDomain ?? (type === 'lark'
            ? 'https://open.larksuite.com'
            : 'https://open.feishu.cn');
          return await this.sendFeishu(cfg.feishuAppId!, cfg.feishuAppSecret!, cfg.chatId!, text, domain);
        }

        case 'dingtalk':
          return await this.sendDingTalk(
            cfg.dingClientId!, cfg.dingClientSecret!, cfg.dingRobotCode!, cfg.chatId!, text,
          );

        case 'wps-xiezuo':
          return await this.sendWpsXiezuo(cfg.wpsAppId!, cfg.wpsAppSecret!, cfg.chatId!, text);

        case 'weibo':
          return await this.sendWeibo(cfg.weiboAccessToken!, cfg.weiboUid!, text);

        case 'wecom':
          return await this.sendWecom(
            cfg.wecomCorpId!, cfg.wecomCorpSecret!, cfg.wecomAgentId!, cfg.chatId!, text,
          );

        case 'weixin':
          return await this.sendWeixin(cfg.weixinToken!, cfg.weixinContextToken!, text);

        case 'qq':
          return await this.sendQQ(cfg.qqHttpUrl!, cfg.chatId!, text, cfg.qqGroupId);

        case 'qqbot':
          return await this.sendQQBot(
            cfg.qqbotAppId!, cfg.qqbotClientSecret!, cfg.chatId!, text, cfg.qqbotGuildId,
          );

        case 'line':
          return await this.sendLine(cfg.lineChannelAccessToken!, cfg.chatId!, text);

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

  private async sendSignal(apiUrl: string, from: string, to: string, text: string): Promise<boolean> {
    // Signal-CLI REST API — https://github.com/bbernhard/signal-cli-rest-api
    const url = `${apiUrl}/v2/send`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, number: from, recipients: [to] }),
    });
    return resp.ok;
  }

  // ── Feishu / Lark ─────────────────────────────────────────────────────────
  // Docs: https://open.feishu.cn/document/server-docs/im-v1/message/create
  private async getFeishuTenantToken(appId: string, appSecret: string, domain: string): Promise<string> {
    const url = `${domain}/open-apis/auth/v3/tenant_access_token/internal`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const data = await resp.json() as { tenant_access_token?: string; code?: number; msg?: string };
    if (!data.tenant_access_token) {
      throw new Error(`Feishu token error ${data.code}: ${data.msg}`);
    }
    return data.tenant_access_token;
  }

  private async sendFeishu(appId: string, appSecret: string, chatId: string, text: string, domain: string): Promise<boolean> {
    const token = await this.getFeishuTenantToken(appId, appSecret, domain);
    const url = `${domain}/open-apis/im/v1/messages?receive_id_type=chat_id`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      }),
    });
    return resp.ok;
  }

  // ── DingTalk ────────────────────────────────────────────────────────────────
  // Docs: https://open.dingtalk.com/document/orgapp/chatbots-send-one-on-one-chat-messages-in-batches
  private async getDingTalkToken(clientId: string, clientSecret: string): Promise<string> {
    const url = 'https://api.dingtalk.com/v1.0/oauth2/accessToken';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appKey: clientId, appSecret: clientSecret }),
    });
    const data = await resp.json() as { accessToken?: string; expireIn?: number };
    if (!data.accessToken) throw new Error('DingTalk token fetch failed');
    return data.accessToken;
  }

  private async sendDingTalk(clientId: string, clientSecret: string, robotCode: string, userId: string, text: string): Promise<boolean> {
    // If userId looks like a sessionWebhook URL, post directly to it
    if (userId.startsWith('https://')) {
      const payload = {
        msgtype: 'markdown',
        markdown: { title: 'TIMPS', text },
      };
      const resp = await fetch(userId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return resp.ok;
    }
    // Otherwise use proactive API
    const token = await this.getDingTalkToken(clientId, clientSecret);
    const msgParam = JSON.stringify({ text });
    const body = {
      robotCode,
      userIds: [userId],
      msgKey: 'sampleMarkdown',
      msgParam,
    };
    const resp = await fetch('https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-acs-dingtalk-access-token': token,
      },
      body: JSON.stringify(body),
    });
    return resp.ok;
  }

  // ── WPS Xiezuo ──────────────────────────────────────────────────────────────
  // Docs: https://open.wps.cn/docs/developer
  private async getWpsToken(appId: string, appSecret: string): Promise<string> {
    const url = 'https://open.wps.cn/api/auth/token';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const data = await resp.json() as { access_token?: string };
    if (!data.access_token) throw new Error('WPS token fetch failed');
    return data.access_token;
  }

  private async sendWpsXiezuo(appId: string, appSecret: string, chatId: string, text: string): Promise<boolean> {
    const token = await this.getWpsToken(appId, appSecret);
    const url = 'https://open.wps.cn/api/im/message/send';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ to_id: chatId, content: { type: 'text', text } }),
    });
    return resp.ok;
  }

  // ── Weibo ────────────────────────────────────────────────────────────────────
  // Docs: https://open.weibo.com/wiki/C/2/direct_messages/new
  private async sendWeibo(accessToken: string, uid: string, text: string): Promise<boolean> {
    const params = new URLSearchParams({ access_token: accessToken, uid, text });
    const resp = await fetch('https://api.weibo.com/2/direct_messages/new.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    return resp.ok;
  }

  // ── WeChat Work (WeCom) ──────────────────────────────────────────────────────
  // Docs: https://developer.work.weixin.qq.com/document/path/90236
  private async getWecomToken(corpId: string, corpSecret: string): Promise<string> {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`;
    const resp = await fetch(url);
    const data = await resp.json() as { access_token?: string; errcode?: number; errmsg?: string };
    if (!data.access_token) throw new Error(`WeCom token error ${data.errcode}: ${data.errmsg}`);
    return data.access_token;
  }

  private async sendWecom(corpId: string, corpSecret: string, agentId: number | undefined, userId: string, text: string): Promise<boolean> {
    const token = await this.getWecomToken(corpId, corpSecret);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
    const body: Record<string, unknown> = {
      touser: userId,
      msgtype: 'text',
      agentid: agentId ?? 0,
      text: { content: text },
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return resp.ok;
  }

  // ── Weixin personal (ilink) ──────────────────────────────────────────────────
  // Docs: https://ilink.weixin.qq.com/
  private async sendWeixin(token: string, contextToken: string | undefined, text: string): Promise<boolean> {
    const url = 'https://ilink.qq.com/open-apis/v1/message/send';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        context_token: contextToken ?? '',
        type: 'text',
        text: { content: text },
      }),
    });
    return resp.ok;
  }

  // ── QQ via NapCat / OneBot v11 ───────────────────────────────────────────────
  // Docs: https://github.com/NapNeko/NapCatQQ
  //       https://github.com/botuniverse/onebot-11
  private async sendQQ(httpUrl: string, userId: string, text: string, groupId?: string): Promise<boolean> {
    const base = httpUrl.replace(/\/$/, '');
    if (groupId) {
      const resp = await fetch(`${base}/send_group_msg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: parseInt(groupId, 10), message: text }),
      });
      return resp.ok;
    }
    const resp = await fetch(`${base}/send_private_msg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: parseInt(userId, 10), message: text }),
    });
    return resp.ok;
  }

  // ── QQ Bot Official ──────────────────────────────────────────────────────────
  // Docs: https://bot.q.qq.com/wiki/develop/api-v2/
  private async getQQBotToken(appId: string, clientSecret: string): Promise<string> {
    const resp = await fetch('https://bots.qq.com/app/getAppAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, clientSecret }),
    });
    const data = await resp.json() as { access_token?: string };
    if (!data.access_token) throw new Error('QQ Bot token fetch failed');
    return data.access_token;
  }

  private async sendQQBot(appId: string, clientSecret: string, channelId: string, text: string, guildId?: string): Promise<boolean> {
    const token = await this.getQQBotToken(appId, clientSecret);
    const base = 'https://api.sgroup.qq.com';
    // Prefer group channel message; fall back to direct message
    const url = guildId
      ? `${base}/channels/${channelId}/messages`
      : `${base}/v2/groups/${channelId}/messages`;
    const body = guildId
      ? { content: text }
      : { content: text, msg_type: 0 };
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `QQBot ${token}`,
      },
      body: JSON.stringify(body),
    });
    return resp.ok;
  }

  // ── LINE Messaging API ────────────────────────────────────────────────────────
  // Docs: https://developers.line.biz/en/docs/messaging-api/
  private async sendLine(channelAccessToken: string, userId: string, text: string): Promise<boolean> {
    const resp = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text }],
      }),
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
        telegram:   { type: 'telegram',   enabled: false },
        discord:    { type: 'discord',    enabled: false },
        slack:      { type: 'slack',      enabled: false },
        whatsapp:   { type: 'whatsapp',   enabled: false },
        signal:     { type: 'signal',     enabled: false },
        feishu:     { type: 'feishu',     enabled: false },
        lark:       { type: 'lark',       enabled: false },
        dingtalk:   { type: 'dingtalk',   enabled: false },
        'wps-xiezuo': { type: 'wps-xiezuo', enabled: false },
        weibo:      { type: 'weibo',      enabled: false },
        wecom:      { type: 'wecom',      enabled: false },
        weixin:     { type: 'weixin',     enabled: false },
        qq:         { type: 'qq',         enabled: false },
        qqbot:      { type: 'qqbot',      enabled: false },
        line:       { type: 'line',       enabled: false },
      },
      sessionSecret: generateRandomSecret(32),
      defaultWorkingDir: os.homedir(),
      version: '2.0',
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
      if (!config.enabled) continue;

      this.platforms.set(type as Platform, new GatewayPlatform(config));

      switch (type as Platform) {
        case 'telegram':
          if (config.botToken) this.startTelegramPolling(config.botToken, config.allowedUsers);
          break;
        case 'discord':
          if (config.botToken) this.startDiscordGateway(config.botToken, config.allowedUsers);
          break;
        case 'slack':
          if (config.botToken) this.startSlackPolling(config.botToken, config.allowedUsers);
          break;
        case 'feishu':
        case 'lark': {
          const domain = config.feishuDomain ?? (type === 'lark'
            ? 'https://open.larksuite.com'
            : 'https://open.feishu.cn');
          if (config.feishuAppId && config.feishuAppSecret) {
            this.startFeishuWebhook(type as Platform, config.feishuAppId, config.feishuAppSecret, domain, config.allowedUsers);
          }
          break;
        }
        case 'dingtalk':
          if (config.dingClientId && config.dingClientSecret) {
            this.startDingTalkStream(config.dingClientId, config.dingClientSecret, config.allowedUsers);
          }
          break;
        case 'weibo':
          if (config.weiboAccessToken) {
            this.startWeiboPolling(config.weiboAccessToken, config.allowedUsers);
          }
          break;
        case 'wecom':
          if (config.wecomCorpId && config.wecomCorpSecret) {
            this.startWecomWebhook(config.wecomCorpId, config.wecomCorpSecret, config.wecomAgentId, config.allowedUsers);
          }
          break;
        case 'weixin':
          if (config.weixinToken) {
            this.startWeixinPolling(config.weixinToken, config.weixinContextToken, config.allowedUsers);
          }
          break;
        case 'qq':
          if (config.qqWsUrl) {
            this.startQQWebSocket(config.qqWsUrl, config.qqSelfId, config.allowedUsers);
          } else if (config.qqHttpUrl) {
            this.startQQPolling(config.qqHttpUrl, config.qqSelfId, config.allowedUsers);
          }
          break;
        case 'qqbot':
          if (config.qqbotAppId && config.qqbotClientSecret) {
            this.startQQBotGateway(config.qqbotAppId, config.qqbotClientSecret, config.allowedUsers);
          }
          break;
        case 'line':
          if (config.lineChannelAccessToken && config.lineChannelSecret) {
            this.startLineWebhook(config.lineChannelAccessToken, config.lineChannelSecret, config.lineWebhookPort ?? 8080, config.allowedUsers);
          }
          break;
      }
    }

    console.log(`[Gateway] Started with ${this.platforms.size} platform(s)`);
  }

  // ── Telegram long-polling ──────────────────────────────────────────────────
  private startTelegramPolling(token: string, allowedUsers?: string[]): void {
    let offset = 0;

    const poll = async () => {
      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=60&offset=${offset}`;
        const resp = await fetch(url);
        const data = await resp.json() as { result?: Array<{ update_id: number; message?: { text?: string; from?: { id: number }; chat?: { id: number } } }> };

        for (const update of data.result ?? []) {
          offset = update.update_id + 1;
          const msg = update.message?.text;
          const userId = String(update.message?.from?.id ?? '');
          const chatId = update.message?.chat?.id;

          if (msg && this.agentCallback) {
            if (allowedUsers?.length && !allowedUsers.includes(userId)) continue;
            const response = await this.agentCallback(msg, 'telegram', userId);
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: response }),
            });
          }
        }
      } catch { /* transient errors — retry */ }

      if (this.running) setTimeout(poll, 1000);
    };

    poll();
    console.log('[Gateway] Telegram polling started');
  }

  // ── Discord gateway ────────────────────────────────────────────────────────
  // Uses Discord Gateway WebSocket API (opcode 0 MESSAGE_CREATE)
  private startDiscordGateway(token: string, allowedUsers?: string[]): void {
    const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';

    const connect = () => {
      try {
        const ws = new WebSocket(GATEWAY_URL);
        let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

        ws.onopen = () => console.log('[Gateway] Discord WebSocket connected');

        ws.onmessage = async (event) => {
          const payload = JSON.parse(String(event.data)) as {
            op: number; d?: Record<string, unknown>; s?: number; t?: string;
          };

          if (payload.op === 10) {
            // Hello — start heartbeating and identify
            const interval = (payload.d as { heartbeat_interval: number }).heartbeat_interval;
            heartbeatInterval = setInterval(() => {
              ws.send(JSON.stringify({ op: 1, d: null }));
            }, interval);
            ws.send(JSON.stringify({
              op: 2,
              d: { token, intents: 33280, properties: { os: 'linux', browser: 'timps', device: 'timps' } },
            }));
          } else if (payload.op === 0 && payload.t === 'MESSAGE_CREATE') {
            const msg = payload.d as { content?: string; author?: { id: string; bot?: boolean }; channel_id?: string };
            if (msg.author?.bot) return;
            const text = msg.content ?? '';
            const userId = msg.author?.id ?? '';
            if (!text || !userId) return;
            if (allowedUsers?.length && !allowedUsers.includes(userId)) return;
            if (this.agentCallback) {
              const reply = await this.agentCallback(text, 'discord', userId);
              await fetch(`https://discord.com/api/v10/channels/${msg.channel_id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bot ${token}` },
                body: JSON.stringify({ content: reply }),
              });
            }
          }
        };

        ws.onclose = () => {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          if (this.running) setTimeout(connect, 5000);
        };
        ws.onerror = () => { /* reconnect on close */ };
      } catch (err) {
        console.error('[Gateway] Discord connect error:', err);
        if (this.running) setTimeout(connect, 10000);
      }
    };

    connect();
    console.log('[Gateway] Discord gateway connecting...');
  }

  // ── Slack event polling ────────────────────────────────────────────────────
  // Uses RTM/Socket Mode lite (conversations.history polling)
  private startSlackPolling(token: string, allowedUsers?: string[]): void {
    const seenTs = new Set<string>();

    const poll = async () => {
      try {
        // Get bot's user ID to filter own messages
        const infoResp = await fetch('https://slack.com/api/auth.test', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const info = await infoResp.json() as { user_id?: string; ok: boolean };
        const botUserId = info.user_id ?? '';

        const chResp = await fetch('https://slack.com/api/conversations.list?types=im,public_channel', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const chData = await chResp.json() as { channels?: Array<{ id: string }> };

        for (const ch of chData.channels ?? []) {
          const histResp = await fetch(`https://slack.com/api/conversations.history?channel=${ch.id}&limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const hist = await histResp.json() as { messages?: Array<{ ts: string; text?: string; user?: string; bot_id?: string }> };

          for (const m of hist.messages ?? []) {
            if (m.bot_id) continue; // skip own messages
            if (seenTs.has(m.ts)) continue;
            seenTs.add(m.ts);
            if (!m.text || !m.user) continue;
            if (allowedUsers?.length && !allowedUsers.includes(m.user)) continue;
            if (this.agentCallback) {
              const reply = await this.agentCallback(m.text, 'slack', m.user);
              await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ channel: ch.id, text: reply }),
              });
            }
          }
        }
      } catch { /* transient */ }

      if (this.running) setTimeout(poll, 3000);
    };

    poll();
    console.log('[Gateway] Slack polling started');
  }

  // ── Feishu / Lark receive ──────────────────────────────────────────────────
  // Starts a lightweight HTTP server on a configurable port to receive Feishu
  // push events when the bot is configured with a callback URL.
  // For pure WebSocket long connection mode, the Feishu open platform SDK
  // should be used; this implementation uses the webhook/event push approach.
  private startFeishuWebhook(
    platform: Platform,
    appId: string,
    appSecret: string,
    domain: string,
    allowedUsers?: string[],
  ): void {
    const port = 8181;
    let tokenCache = { token: '', expiresAt: 0 };

    const getToken = async (): Promise<string> => {
      if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
      const url = `${domain}/open-apis/auth/v3/tenant_access_token/internal`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      });
      const data = await resp.json() as { tenant_access_token?: string; expire?: number };
      tokenCache = { token: data.tenant_access_token ?? '', expiresAt: Date.now() + (data.expire ?? 7200) * 1000 - 300_000 };
      return tokenCache.token;
    };

    import('node:http').then(http => {

      this.httpServer = http.createServer(async (req: any, res: any) => {
        if (req.method !== 'POST') { res.end('{}'); return; }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', async () => {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as {
            challenge?: string;
            header?: { event_type?: string };
            event?: { message?: { content?: string; chat_id?: string }; sender?: { sender_id?: { open_id?: string } } };
          };

          // URL verification challenge
          if (body.challenge) { res.end(JSON.stringify({ challenge: body.challenge })); return; }

          if (body.header?.event_type === 'im.message.receive_v1' && body.event?.message && this.agentCallback) {
            const userId = body.event.sender?.sender_id?.open_id ?? '';
            const chatId = body.event.message.chat_id ?? '';
            let text = '';
            try { text = JSON.parse(body.event.message.content ?? '{}').text ?? ''; } catch { /* ignore */ }

            if (text && (!allowedUsers?.length || allowedUsers.includes(userId))) {
              const reply = await this.agentCallback(text, platform, userId);
              const token = await getToken();
              await fetch(`${domain}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: reply }) }),
              });
            }
          }
          res.end('{}');
        });
      }).listen(port, () => console.log(`[Gateway] Feishu webhook listening on :${port}`));
    }).catch(() => console.warn('[Gateway] node:http unavailable — Feishu webhook disabled'));
  }

  // ── DingTalk Stream ────────────────────────────────────────────────────────
  // DingTalk uses a WebSocket "stream" connection for receiving messages
  // without a public URL. This initiates a GET /v1.0/gateway/connections/open
  // call to get a WebSocket endpoint, then connects.
  private startDingTalkStream(clientId: string, clientSecret: string, allowedUsers?: string[]): void {
    const getEndpoint = async () => {
      const tokenResp = await fetch('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: clientId, appSecret: clientSecret }),
      });
      const tokenData = await tokenResp.json() as { accessToken?: string };
      const token = tokenData.accessToken ?? '';

      const connResp = await fetch('https://api.dingtalk.com/v1.0/gateway/connections/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-acs-dingtalk-access-token': token },
        body: JSON.stringify({
          clientId,
          clientSecret,
          subscriptions: [{ type: 'EVENT', topic: 'chat:message:userSend' }],
          ua: 'timps/2.0',
        }),
      });
      const connData = await connResp.json() as { endpoint?: string; ticket?: string };
      return connData;
    };

    const connect = async () => {
      try {
        const { endpoint, ticket } = await getEndpoint();
        if (!endpoint || !ticket) { throw new Error('No DingTalk stream endpoint'); }

        const ws = new WebSocket(`${endpoint}?ticket=${encodeURIComponent(ticket)}`);
        ws.onopen = () => console.log('[Gateway] DingTalk stream connected');

        ws.onmessage = async (event) => {
          const frame = JSON.parse(String(event.data)) as {
            specVersion?: string; type?: string; topic?: string;
            headers?: { messageId?: string; contentType?: string };
            data?: string;
          };

          // Send ACK for every frame
          if (frame.headers?.messageId) {
            ws.send(JSON.stringify({
              code: 200, headers: frame.headers, message: 'OK', data: '',
            }));
          }

          if (frame.type !== 'EVENT' || frame.topic !== 'chat:message:userSend') return;
          const msg = JSON.parse(frame.data ?? '{}') as {
            senderId?: string; senderNick?: string; text?: { content?: string };
            sessionWebhook?: string; conversationId?: string;
          };
          const text = msg.text?.content?.trim() ?? '';
          const userId = msg.senderId ?? '';
          if (!text || !userId) return;
          if (allowedUsers?.length && !allowedUsers.includes(userId)) return;

          if (this.agentCallback) {
            const reply = await this.agentCallback(text, 'dingtalk', userId);
            const sessionWebhook = msg.sessionWebhook;
            if (sessionWebhook) {
              await fetch(sessionWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msgtype: 'markdown', markdown: { title: 'TIMPS', text: reply } }),
              });
            }
          }
        };

        ws.onclose = () => {
          if (this.running) setTimeout(connect, 5000);
        };
      } catch (err) {
        console.error('[Gateway] DingTalk stream error:', err);
        if (this.running) setTimeout(connect, 10000);
      }
    };

    connect();
    console.log('[Gateway] DingTalk stream connecting...');
  }

  // ── Weibo polling ──────────────────────────────────────────────────────────
  private startWeiboPolling(accessToken: string, allowedUsers?: string[]): void {
    const seen = new Set<string>();

    const poll = async () => {
      try {
        const url = `https://api.weibo.com/2/direct_messages.json?access_token=${accessToken}&count=20`;
        const resp = await fetch(url);
        const data = await resp.json() as { direct_messages?: Array<{ id?: string; text?: string; sender_id?: number }> };

        for (const dm of data.direct_messages ?? []) {
          const id = String(dm.id ?? '');
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const userId = String(dm.sender_id ?? '');
          const text = dm.text ?? '';
          if (!text || !userId) continue;
          if (allowedUsers?.length && !allowedUsers.includes(userId)) continue;

          if (this.agentCallback) {
            const reply = await this.agentCallback(text, 'weibo', userId);
            const params = new URLSearchParams({ access_token: accessToken, uid: userId, text: reply });
            await fetch('https://api.weibo.com/2/direct_messages/new.json', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString(),
            });
          }
        }
      } catch { /* transient */ }

      if (this.running) setTimeout(poll, 5000);
    };

    poll();
    console.log('[Gateway] Weibo polling started');
  }

  // ── WeChat Work (WeCom) webhook ────────────────────────────────────────────
  private startWecomWebhook(corpId: string, corpSecret: string, agentId: number | undefined, allowedUsers?: string[]): void {
    const port = 8182;
    let tokenCache = { token: '', expiresAt: 0 };

    const getToken = async (): Promise<string> => {
      if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
      const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`;
      const resp = await fetch(url);
      const data = await resp.json() as { access_token?: string; expires_in?: number };
      tokenCache = { token: data.access_token ?? '', expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 - 300_000 };
      return tokenCache.token;
    };

    import('node:http').then(http => {
      this.httpServer = http.createServer(async (req: any, res: any) => {
        if (req.method !== 'POST') { res.end(''); return; }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', async () => {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as {
            MsgType?: string; Content?: string; FromUserName?: string; ToUserName?: string;
          };

          if (body.MsgType === 'text' && body.Content && this.agentCallback) {
            const userId = body.FromUserName ?? '';
            if (!allowedUsers?.length || allowedUsers.includes(userId)) {
              const reply = await this.agentCallback(body.Content, 'wecom', userId);
              const token = await getToken();
              await fetch(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ touser: userId, msgtype: 'text', agentid: agentId ?? 0, text: { content: reply } }),
              });
            }
          }
          res.end('');
        });
      }).listen(port, () => console.log(`[Gateway] WeCom webhook listening on :${port}`));
    }).catch(() => console.warn('[Gateway] node:http unavailable — WeCom webhook disabled'));
  }

  // ── Weixin (ilink) polling ──────────────────────────────────────────────────
  private startWeixinPolling(token: string, contextToken: string | undefined, allowedUsers?: string[]): void {
    const poll = async () => {
      try {
        const resp = await fetch('https://ilink.qq.com/open-apis/v1/message/receive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ context_token: contextToken ?? '', timeout: 20 }),
        });
        const data = await resp.json() as { messages?: Array<{ user_id?: string; content?: string }> };

        for (const m of data.messages ?? []) {
          const userId = m.user_id ?? '';
          const text = m.content ?? '';
          if (!text || !userId) continue;
          if (allowedUsers?.length && !allowedUsers.includes(userId)) continue;
          if (this.agentCallback) {
            const reply = await this.agentCallback(text, 'weixin', userId);
            await fetch('https://ilink.qq.com/open-apis/v1/message/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ context_token: contextToken ?? '', type: 'text', text: { content: reply } }),
            });
          }
        }
      } catch { /* long-poll timeout is normal */ }

      if (this.running) setTimeout(poll, 1000);
    };

    poll();
    console.log('[Gateway] Weixin (ilink) polling started');
  }

  // ── QQ (NapCat/OneBot v11) WebSocket ─────────────────────────────────────
  private startQQWebSocket(wsUrl: string, selfId: string | undefined, allowedUsers?: string[]): void {
    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => console.log('[Gateway] QQ (NapCat) WebSocket connected');

        ws.onmessage = async (event) => {
          const data = JSON.parse(String(event.data)) as {
            post_type?: string; message_type?: string; user_id?: number;
            group_id?: number; message?: string; self_id?: number;
          };

          if (data.post_type !== 'message') return;
          if (selfId && String(data.self_id) === selfId) return; // skip own messages
          const userId = String(data.user_id ?? '');
          const text = data.message ?? '';
          if (!text || !userId) return;
          if (allowedUsers?.length && !allowedUsers.includes(userId)) return;

          if (this.agentCallback) {
            const reply = await this.agentCallback(text, 'qq', userId);
            const payload = data.message_type === 'group'
              ? { action: 'send_group_msg', params: { group_id: data.group_id, message: reply } }
              : { action: 'send_private_msg', params: { user_id: data.user_id, message: reply } };
            ws.send(JSON.stringify(payload));
          }
        };

        ws.onclose = () => {
          if (this.running) setTimeout(connect, 5000);
        };
      } catch (err) {
        console.error('[Gateway] QQ WebSocket error:', err);
        if (this.running) setTimeout(connect, 10000);
      }
    };

    connect();
    console.log('[Gateway] QQ (NapCat) WebSocket connecting...');
  }

  // QQ HTTP polling fallback (when only HTTP API is available)
  private startQQPolling(httpUrl: string, selfId: string | undefined, allowedUsers?: string[]): void {
    const base = httpUrl.replace(/\/$/, '');
    const seen = new Set<number>();

    const poll = async () => {
      try {
        const resp = await fetch(`${base}/get_friend_msg_history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 20 }),
        });
        const data = await resp.json() as { data?: { messages?: Array<{ message_id?: number; user_id?: number; message?: string }> } };

        for (const m of data.data?.messages ?? []) {
          const id = m.message_id ?? 0;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const userId = String(m.user_id ?? '');
          const text = m.message ?? '';
          if (!text || !userId) continue;
          if (allowedUsers?.length && !allowedUsers.includes(userId)) continue;
          if (this.agentCallback) {
            const reply = await this.agentCallback(text, 'qq', userId);
            await fetch(`${base}/send_private_msg`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: parseInt(userId, 10), message: reply }),
            });
          }
        }
      } catch { /* transient */ }

      if (this.running) setTimeout(poll, 2000);
    };

    poll();
    console.log('[Gateway] QQ HTTP polling started');
  }

  // ── QQ Bot Official WebSocket gateway ────────────────────────────────────
  private startQQBotGateway(appId: string, clientSecret: string, allowedUsers?: string[]): void {
    const getToken = async () => {
      const resp = await fetch('https://bots.qq.com/app/getAppAccessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, clientSecret }),
      });
      const data = await resp.json() as { access_token?: string };
      return data.access_token ?? '';
    };

    const connect = async () => {
      try {
        const token = await getToken();
        // Get WebSocket gateway URL
        const gwResp = await fetch('https://api.sgroup.qq.com/gateway', {
          headers: { 'Authorization': `QQBot ${token}` },
        });
        const gwData = await gwResp.json() as { url?: string };
        const wsUrl = gwData.url;
        if (!wsUrl) throw new Error('No QQ Bot gateway URL');

        const ws = new WebSocket(wsUrl);
        let seq = 0;

        ws.onopen = () => console.log('[Gateway] QQ Bot Official WebSocket connected');

        ws.onmessage = async (event) => {
          const payload = JSON.parse(String(event.data)) as {
            op: number; d?: Record<string, unknown>; s?: number; t?: string;
          };
          if (payload.s) seq = payload.s;

          if (payload.op === 10) {
            // Hello — identify
            const interval = (payload.d as { heartbeat_interval: number }).heartbeat_interval;
            setInterval(() => ws.send(JSON.stringify({ op: 1, d: seq })), interval);
            ws.send(JSON.stringify({
              op: 2,
              d: { token: `QQBot ${token}`, intents: 0 | (1 << 9) | (1 << 12), shard: [0, 1] },
            }));
          } else if (payload.op === 0 && this.agentCallback) {
            const d = payload.d ?? {};
            const text = (d.content as string ?? '').replace(/<@!\d+>/, '').trim();
            const userId = (d.author as { id?: string })?.id ?? '';
            const channelId = d.channel_id as string ?? '';
            const guildId = d.guild_id as string ?? '';
            if (!text || !userId) return;
            if (allowedUsers?.length && !allowedUsers.includes(userId)) return;

            const reply = await this.agentCallback(text, 'qqbot', userId);
            await fetch(`https://api.sgroup.qq.com/channels/${channelId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `QQBot ${token}` },
              body: JSON.stringify({ content: reply, msg_id: d.id }),
            });
          }
        };

        ws.onclose = () => {
          if (this.running) setTimeout(connect, 5000);
        };
      } catch (err) {
        console.error('[Gateway] QQ Bot gateway error:', err);
        if (this.running) setTimeout(connect, 10000);
      }
    };

    connect();
    console.log('[Gateway] QQ Bot Official gateway connecting...');
  }

  // ── LINE webhook server ────────────────────────────────────────────────────
  private startLineWebhook(channelAccessToken: string, channelSecret: string, port: number, allowedUsers?: string[]): void {
    import('node:http').then(http => {
      import('node:crypto').then(crypto => {
        const server = http.createServer(async (req: any, res: any) => {
          if (req.method !== 'POST') { res.writeHead(200); res.end('OK'); return; }
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', async () => {
            const rawBody = Buffer.concat(chunks);
            // Verify LINE signature
            const sig = req.headers['x-line-signature'] as string ?? '';
            const hmac = crypto.createHmac('sha256', channelSecret);
            hmac.update(rawBody);
            const expected = hmac.digest('base64');
            if (sig !== expected) { res.writeHead(401); res.end('Unauthorized'); return; }

            const body = JSON.parse(rawBody.toString()) as {
              events?: Array<{
                type: string; replyToken?: string; source?: { userId?: string };
                message?: { type?: string; text?: string };
              }>;
            };

            for (const ev of body.events ?? []) {
              if (ev.type !== 'message' || ev.message?.type !== 'text') continue;
              const userId = ev.source?.userId ?? '';
              const text = ev.message.text ?? '';
              if (!text || !userId) continue;
              if (allowedUsers?.length && !allowedUsers.includes(userId)) continue;

              if (this.agentCallback && ev.replyToken) {
                const reply = await this.agentCallback(text, 'line', userId);
                await fetch('https://api.line.me/v2/bot/message/reply', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${channelAccessToken}`,
                  },
                  body: JSON.stringify({
                    replyToken: ev.replyToken,
                    messages: [{ type: 'text', text: reply }],
                  }),
                });
              }
            }
            res.writeHead(200); res.end('OK');
          });
        });

        server.listen(port, () => console.log(`[Gateway] LINE webhook listening on :${port}`));
      });
    }).catch(() => console.warn('[Gateway] node:http unavailable — LINE webhook disabled'));
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
    const lines = platforms.map(p => {
      const icon = p.enabled ? '✓' : '○';
      return `  ${icon} ${p.type.padEnd(12)}`;
    });
    return 'TIMPS Gateway — Chat Connectors:\n' + lines.join('\n') + '\n\nRun: timps gateway setup <platform> for setup instructions.';
  }

  if (args[0] === 'setup' && args[1]) {
    switch (args[1] as Platform) {
      // ── Original platforms ─────────────────────────────────────────────────
      case 'telegram': {
        const token = args[2] ?? process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return 'Usage: timps gateway setup telegram <bot_token>\n  Get token from @BotFather on Telegram.';
        gateway.configure('telegram', { type: 'telegram', enabled: true, botToken: token });
        return 'Telegram configured. Run: timps gateway start';
      }
      case 'discord': {
        const token = args[2] ?? process.env.DISCORD_BOT_TOKEN;
        if (!token) return 'Usage: timps gateway setup discord <bot_token>\n  Get token from https://discord.com/developers/applications';
        gateway.configure('discord', { type: 'discord', enabled: true, botToken: token });
        return 'Discord configured. Run: timps gateway start';
      }
      case 'slack': {
        const token = args[2] ?? process.env.SLACK_BOT_TOKEN;
        if (!token) return 'Usage: timps gateway setup slack <bot_token>\n  Get token from https://api.slack.com/apps (xoxb-... Bot User OAuth Token)';
        gateway.configure('slack', { type: 'slack', enabled: true, botToken: token });
        return 'Slack configured. Run: timps gateway start';
      }
      case 'whatsapp': {
        const apiKey = args[2] ?? process.env.WHATSAPP_API_KEY;
        const phone = args[3] ?? process.env.WHATSAPP_PHONE;
        if (!apiKey || !phone) return 'Usage: timps gateway setup whatsapp <api_key> <phone_number>\n  Get credentials from https://developers.facebook.com/docs/whatsapp/cloud-api/';
        gateway.configure('whatsapp', { type: 'whatsapp', enabled: true, apiKey, phoneNumber: phone });
        return 'WhatsApp configured. Run: timps gateway start';
      }
      case 'signal': {
        const apiUrl = args[2] ?? process.env.SIGNAL_CLI_URL ?? 'http://localhost:8080';
        const from = args[3] ?? process.env.SIGNAL_FROM_NUMBER;
        const to = args[4] ?? process.env.SIGNAL_TO_NUMBER;
        if (!from || !to) return 'Usage: timps gateway setup signal <api_url> <from_number> <to_number>\n  Requires signal-cli REST API: https://github.com/bbernhard/signal-cli-rest-api';
        gateway.configure('signal', { type: 'signal', enabled: true, apiKey: apiUrl, chatId: to, phoneNumber: from });
        return 'Signal configured. Run: timps gateway start';
      }

      // ── cc-connect platforms ───────────────────────────────────────────────
      case 'feishu':
      case 'lark': {
        const appId = args[2] ?? process.env.FEISHU_APP_ID ?? process.env.LARK_APP_ID;
        const appSecret = args[3] ?? process.env.FEISHU_APP_SECRET ?? process.env.LARK_APP_SECRET;
        const chatId = args[4] ?? process.env.FEISHU_CHAT_ID ?? process.env.LARK_CHAT_ID;
        const platform = args[1] as 'feishu' | 'lark';
        if (!appId || !appSecret) {
          return `Usage: timps gateway setup ${platform} <app_id> <app_secret> [chat_id]\n`
            + `  1. Create an app at ${platform === 'lark' ? 'https://open.larksuite.com' : 'https://open.feishu.cn'}/app\n`
            + '  2. Enable "im:message:send_as_bot" permission\n'
            + '  3. Enable Event Subscription and subscribe to "Receive messages" (im.message.receive_v1)\n'
            + '  4. Set Callback URL to your public IP:8181/feishu (or use ngrok)';
        }
        gateway.configure(platform, { type: platform, enabled: true, feishuAppId: appId, feishuAppSecret: appSecret, chatId });
        return `${platform === 'lark' ? 'Lark' : 'Feishu'} configured. Run: timps gateway start`;
      }
      case 'dingtalk': {
        const clientId = args[2] ?? process.env.DINGTALK_CLIENT_ID;
        const clientSecret = args[3] ?? process.env.DINGTALK_CLIENT_SECRET;
        const robotCode = args[4] ?? process.env.DINGTALK_ROBOT_CODE;
        if (!clientId || !clientSecret || !robotCode) {
          return 'Usage: timps gateway setup dingtalk <client_id> <client_secret> <robot_code>\n'
            + '  1. Create an internal bot at https://open.dingtalk.com/developer\n'
            + '  2. Enable "Stream Mode" (no public URL needed)\n'
            + '  3. Copy the AppKey (clientId), AppSecret (clientSecret), and robotCode';
        }
        gateway.configure('dingtalk', { type: 'dingtalk', enabled: true, dingClientId: clientId, dingClientSecret: clientSecret, dingRobotCode: robotCode });
        return 'DingTalk configured. Run: timps gateway start';
      }
      case 'wps-xiezuo': {
        const appId = args[2] ?? process.env.WPS_APP_ID;
        const appSecret = args[3] ?? process.env.WPS_APP_SECRET;
        const chatId = args[4] ?? process.env.WPS_CHAT_ID;
        if (!appId || !appSecret) {
          return 'Usage: timps gateway setup wps-xiezuo <app_id> <app_secret> [chat_id]\n'
            + '  1. Register at https://open.wps.cn and create an application\n'
            + '  2. Enable IM messaging permissions';
        }
        gateway.configure('wps-xiezuo', { type: 'wps-xiezuo', enabled: true, wpsAppId: appId, wpsAppSecret: appSecret, chatId });
        return 'WPS Xiezuo configured. Run: timps gateway start';
      }
      case 'weibo': {
        const accessToken = args[2] ?? process.env.WEIBO_ACCESS_TOKEN;
        const uid = args[3] ?? process.env.WEIBO_UID;
        if (!accessToken || !uid) {
          return 'Usage: timps gateway setup weibo <access_token> <uid>\n'
            + '  1. Create an app at https://open.weibo.com/connect\n'
            + '  2. Get an OAuth access_token for your account\n'
            + '  3. uid is the Weibo user ID of the recipient';
        }
        gateway.configure('weibo', { type: 'weibo', enabled: true, weiboAccessToken: accessToken, weiboUid: uid });
        return 'Weibo configured. Run: timps gateway start';
      }
      case 'wecom': {
        const corpId = args[2] ?? process.env.WECOM_CORP_ID;
        const corpSecret = args[3] ?? process.env.WECOM_CORP_SECRET;
        const agentIdStr = args[4] ?? process.env.WECOM_AGENT_ID;
        if (!corpId || !corpSecret || !agentIdStr) {
          return 'Usage: timps gateway setup wecom <corp_id> <corp_secret> <agent_id>\n'
            + '  1. Log in to https://work.weixin.qq.com/\n'
            + '  2. Go to App Management → Create a self-built app\n'
            + '  3. Note the CorpID, AgentSecret, and AgentID\n'
            + '  4. Set Callback URL to your public IP:8182/wecom';
        }
        gateway.configure('wecom', { type: 'wecom', enabled: true, wecomCorpId: corpId, wecomCorpSecret: corpSecret, wecomAgentId: parseInt(agentIdStr, 10) });
        return 'WeChat Work (WeCom) configured. Run: timps gateway start';
      }
      case 'weixin': {
        const token = args[2] ?? process.env.WEIXIN_TOKEN;
        const contextToken = args[3] ?? process.env.WEIXIN_CONTEXT_TOKEN;
        if (!token) {
          return 'Usage: timps gateway setup weixin <ilink_token> [context_token]\n'
            + '  1. Register at https://ilink.weixin.qq.com/\n'
            + '  2. Create an app and get the session token\n'
            + '  Note: For personal WeChat use the ilink bridge service';
        }
        gateway.configure('weixin', { type: 'weixin', enabled: true, weixinToken: token, weixinContextToken: contextToken });
        return 'Weixin (ilink) configured. Run: timps gateway start';
      }
      case 'qq': {
        const httpUrl = args[2] ?? process.env.QQ_HTTP_URL ?? 'http://127.0.0.1:3000';
        const wsUrl = args[3] ?? process.env.QQ_WS_URL ?? 'ws://127.0.0.1:3001';
        const selfId = args[4] ?? process.env.QQ_SELF_ID;
        gateway.configure('qq', { type: 'qq', enabled: true, qqHttpUrl: httpUrl, qqWsUrl: wsUrl, qqSelfId: selfId });
        return 'QQ (NapCat/OneBot) configured.\n'
          + '  Make sure NapCat is running: https://github.com/NapNeko/NapCatQQ\n'
          + '  Run: timps gateway start';
      }
      case 'qqbot': {
        const appId = args[2] ?? process.env.QQBOT_APP_ID;
        const clientSecret = args[3] ?? process.env.QQBOT_CLIENT_SECRET;
        if (!appId || !clientSecret) {
          return 'Usage: timps gateway setup qqbot <app_id> <client_secret>\n'
            + '  1. Register at https://q.qq.com/ (QQ Open Platform)\n'
            + '  2. Create a bot application and get AppID and ClientSecret\n'
            + '  3. Enable Gateway (WebSocket) in bot settings';
        }
        gateway.configure('qqbot', { type: 'qqbot', enabled: true, qqbotAppId: appId, qqbotClientSecret: clientSecret });
        return 'QQ Bot Official configured. Run: timps gateway start';
      }
      case 'line': {
        const channelAccessToken = args[2] ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const channelSecret = args[3] ?? process.env.LINE_CHANNEL_SECRET;
        const portStr = args[4] ?? process.env.LINE_WEBHOOK_PORT ?? '8080';
        if (!channelAccessToken || !channelSecret) {
          return 'Usage: timps gateway setup line <channel_access_token> <channel_secret> [port]\n'
            + '  1. Create a channel at https://developers.line.biz/console/\n'
            + '  2. Messaging API → Issue Channel Access Token\n'
            + '  3. Set Webhook URL to https://<your-public-ip>:<port>/line\n'
            + '  Note: LINE requires a public URL. Use ngrok or deploy to a cloud.';
        }
        gateway.configure('line', { type: 'line', enabled: true, lineChannelAccessToken: channelAccessToken, lineChannelSecret: channelSecret, lineWebhookPort: parseInt(portStr, 10) });
        return 'LINE configured. Run: timps gateway start';
      }

      default:
        return `Unknown platform: ${args[1]}\nSupported: telegram, discord, slack, whatsapp, signal, feishu, lark, dingtalk, wps-xiezuo, weibo, wecom, weixin, qq, qqbot, line`;
    }
  }

  if (args[0] === 'start') {
    await gateway.start();
    return 'Gateway started!';
  }

  if (args[0] === 'stop') {
    await gateway.stop();
    return 'Gateway stopped.';
  }

  return [
    'Usage: timps gateway <command>',
    '',
    'Commands:',
    '  list                       List all platforms and their status',
    '  setup <platform> [args]    Configure a platform (run without args for help)',
    '  start                      Start all enabled platforms',
    '  stop                       Stop all platforms',
    '',
    'Platforms (cc-connect compatible):',
    '  telegram   discord   slack   whatsapp   signal',
    '  feishu     lark      dingtalk   wps-xiezuo',
    '  weibo      wecom     weixin     qq   qqbot   line',
  ].join('\n');
}