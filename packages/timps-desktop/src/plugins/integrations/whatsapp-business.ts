import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface WhatsAppPhone {
  phone: string;
  type: 'CELL' | 'MAIN' | 'FIXED_LINE_OR_MOBILE' | 'HOME' | 'WORK' | 'FAX_HOME' | 'FAX_WORK' | 'OTHER';
}

export interface WhatsAppName {
  first_name: string;
  last_name?: string;
  middle_name?: string;
  prefix?: string;
  suffix?: string;
}

export interface WhatsAppEmail {
  email: string;
  type: 'WORK' | 'HOME' | 'OTHER';
}

export interface WhatsAppOrg {
  company?: string;
  department?: string;
  title?: string;
}

export interface WhatsAppAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  country_code?: string;
  type: 'HOME' | 'WORK' | 'OTHER';
}

export interface WhatsAppContact {
  addresses?: WhatsAppAddress[];
  emails?: WhatsAppEmail[];
  name: WhatsAppName;
  phones?: WhatsAppPhone[];
  org?: WhatsAppOrg;
}

export interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'interactive' | 'reaction';
  text?: { body: string };
  image?: { id?: string; link?: string; caption?: string };
  audio?: { id?: string; link?: string };
  video?: { id?: string; link?: string; caption?: string };
  document?: { id?: string; link?: string; caption?: string; filename?: string };
  sticker?: { id?: string; link?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  reaction?: { message_id: string; emoji: string };
  context?: { message_id: string };
  to?: string;
}

export interface WhatsAppTemplate {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string; policy?: 'deterministic' | 'legacy' };
    components?: WhatsAppTemplateComponent[];
  };
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'footer' | 'buttons';
  parameters?: WhatsAppTemplateParameter[];
}

export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video' | 'audio';
  text?: string;
  currency?: { fallback_value: string; code: string; value: number };
  date_time?: { fallback_value: string };
  image?: { id?: string; link?: string };
  document?: { id?: string; link?: string; filename?: string };
  video?: { id?: string; link?: string };
  audio?: { id?: string; link?: string };
}

export interface WhatsAppTemplateButton {
  type: 'URL' | 'PHONE_NUMBER' | 'OTP' | 'COPY_CODE';
  text: string;
  url?: string;
  phone_number?: string;
  otp_type?: 'OTP' | 'COPY' | 'PIXELATED';
  otp_code?: string;
  otp_code_format?: string;
  otp_length?: number;
}

export interface WhatsAppInteractiveList {
  type: 'list';
  header?: { type: 'text' | 'image' | 'video'; text?: string; image?: { id?: string; link?: string }; video?: { id?: string; link?: string } };
  body?: { text: string };
  footer?: { text: string };
  action: { button: string; sections: WhatsAppListSection[] };
}

export interface WhatsAppListSection {
  title?: string;
  rows: { id: string; title: string; description?: string }[];
}

export interface WhatsAppInteractiveButton {
  type: 'button';
  header?: { type: 'text' | 'image' | 'video'; text?: string; image?: { id?: string; link?: string }; video?: { id?: string; link?: string } };
  body?: { text: string };
  footer?: { text: string };
  action: { buttons: { type: 'reply'; reply: { id: string; title: string } }[] };
}

export interface WhatsAppMediaResponse {
  id: string;
  mime_type: string;
  file_size: number;
  file_id: string;
}

export interface WhatsAppConversation {
  id: string;
  originate: string;
  timestamp: string;
}

export interface WhatsAppError {
  code: number;
  title: string;
  message: string;
  error_data?: { code: string; description: string; entity_data?: string };
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppMessageEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: WhatsAppMetadata;
      messages?: WhatsAppMessage[];
      errors?: WhatsAppError[];
    };
    field: string;
  }>;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppMessageEntry[];
}

const MANIFEST: PluginManifest = {
  id: 'whatsapp-business',
  name: 'WhatsApp Business',
  version: '1.0.0',
  description: 'WhatsApp Business API integration for sending messages, templates, and handling webhooks',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['whatsapp', 'messaging', 'business', 'api'],
};

const SCOPES = [
  'sendMessage',
  'sendTemplate',
  'sendList',
  'sendButtons',
  'sendMedia',
  'sendImage',
  'sendVideo',
  'sendAudio',
  'sendDocument',
  'sendLocation',
  'sendReaction',
  'replyToMessage',
  'uploadMedia',
  'registerPhone',
  'updateBusinessProfile',
  'getBusinessProfile',
  'createWebhook',
  'deleteWebhook',
  'getTemplates',
  'createTemplate',
  'updateTemplate',
  'deleteTemplate',
  'getMessage',
  'getMedia',
  'markAsRead',
  'getPhoneNumber',
  'verifyPhoneNumber',
];

export default class WhatsAppBusinessIntegration extends IntegrationBase {
  private apiBase = 'https://graph.facebook.com/v18.0';
  private phoneNumberId: string | null = null;
  private businessAccountId: string | null = null;
  private webhookVerifyToken: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['message', 'message_sent', 'message_delivered', 'message_read', 'status', 'unsupported'],
      dataModels: ['message', 'contact', 'template', 'media', 'webhook'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('Access token is required');
    }
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Client ID and secret are required');
    }
    this.setAccessToken(config.accessToken);
    this.businessAccountId = config.clientId;

    try {
      const phoneNumbers = await this.apiCall<{ data: Array<{ id: string }> }>(
        `${this.apiBase}/me/phone_numbers`,
        {
          headers: { Authorization: `Bearer ${config.accessToken}` },
        }
      );
      if (phoneNumbers.data && phoneNumbers.data.length > 0) {
        this.phoneNumberId = phoneNumbers.data[0].id;
      }
      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken || !this.phoneNumberId) return false;
    try {
      await this.apiCall(`${this.apiBase}/${this.phoneNumberId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('Not authenticated');
    }

    const endpoint = `${this.apiBase}/${this.phoneNumberId}/messages`;

    switch (action) {
      case 'sendMessage':
        return this.apiCall<{ messaging_product: string; to: string; id: string; message_id: string }>(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'text',
            text: { body: params.text as string },
          } as WhatsAppMessage),
        });

      case 'sendImage':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'image',
            image: { link: params.imageUrl as string, caption: params.caption as string },
          }),
        });

      case 'sendVideo':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'video',
            video: { link: params.videoUrl as string, caption: params.caption as string },
          }),
        });

      case 'sendAudio':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'audio',
            audio: { link: params.audioUrl as string },
          }),
        });

      case 'sendDocument':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'document',
            document: { link: params.documentUrl as string, filename: params.filename as string },
          }),
        });

      case 'sendLocation':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'location',
            location: {
              latitude: params.latitude as number,
              longitude: params.longitude as number,
              name: params.name as string,
              address: params.address as string,
            },
          }),
        });

      case 'sendTemplate':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'template',
            template: {
              name: params.templateName as string,
              language: { code: (params.language as string) || 'en_US' },
              components: params.components as WhatsAppTemplateComponent[],
            },
          } as WhatsAppTemplate),
        });

      case 'sendList':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'interactive',
            interactive: params.interactive as WhatsAppInteractiveList,
          }),
        });

      case 'sendButtons':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'interactive',
            interactive: params.interactive as WhatsAppInteractiveButton,
          }),
        });

      case 'sendReaction':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'reaction',
            reaction: { message_id: params.messageId, emoji: params.emoji as string },
          }),
        });

      case 'replyToMessage':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'text',
            text: { body: params.text as string },
            context: { message_id: params.contextMessageId as string },
          }),
        });

      case 'uploadMedia':
        return this.apiCall<{ id: string }>(`${this.apiBase}/${this.phoneNumberId}/media`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'multipart/form-data',
          },
          body: params.formData as string,
        });

      case 'getMedia':
        return this.apiCall<WhatsAppMediaResponse>(`${this.apiBase}/${params.mediaId}`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });

      case 'getMessage':
        return this.apiCall(`${this.apiBase}/${params.messageId}`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });

      case 'markAsRead':
        return this.apiCall(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: params.messageId,
          }),
        });

      case 'getTemplates':
        return this.apiCall<{ data: WhatsAppTemplate[] }>(`${this.apiBase}/message_templates`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });

      case 'createTemplate':
        return this.apiCall(`${this.apiBase}/message_templates`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify(params.template),
        });

      case 'getBusinessProfile':
        return this.apiCall(`${this.apiBase}/me/business_profile`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });

      case 'updateBusinessProfile':
        return this.apiCall(`${this.apiBase}/me/business_profile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify(params.profile),
        });

      case 'registerPhone':
        return this.apiCall(`${this.apiBase}/phone_number/register`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({ verify_code: params.verifyCode, pin: params.pin }),
        });

      case 'verifyPhoneNumber':
        return this.apiCall(`${this.apiBase}/phone_number/verify`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: JSON.stringify({ verify_code: params.verifyCode }),
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'templates':
        return this.executeAction('getTemplates', options || {});
      case 'profile':
        return this.executeAction('getBusinessProfile', options || {});
      case 'media':
        return this.executeAction('getMedia', { mediaId: options?.mediaId });
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  setWebhookVerifyToken(token: string): void {
    this.webhookVerifyToken = token;
  }

  verifyWebhook(mode: string, token: string, challenge: string): string {
    if (this.webhookVerifyToken === token) {
      return challenge;
    }
    throw new Error('Invalid webhook verify token');
  }

  parseWebhook(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
    const messages: WhatsAppMessage[] = [];
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.value.messages) {
          messages.push(...change.value.messages);
        }
      }
    }
    return messages;
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.phoneNumberId = null;
    this.businessAccountId = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createWhatsAppBusinessIntegration(): WhatsAppBusinessIntegration {
  return new WhatsAppBusinessIntegration();
}