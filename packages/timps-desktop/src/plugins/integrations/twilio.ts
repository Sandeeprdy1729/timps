import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface TwilioMessage {
  sid: string;
  account_sid: string;
  to: string;
  from: string;
  body: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  date_created: string;
  date_sent: string | null;
  error_code: string | null;
  error_message: string | null;
}

export interface TwilioCall {
  sid: string;
  account_sid: string;
  to: string;
  from: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  start_time: string | null;
  end_time: string | null;
  duration: string | null;
  price: string | null;
  url: string | null;
}

export interface TwilioRecording {
  sid: string;
  account_sid: string;
  call_sid: string;
  duration: number;
  recording_url: string;
  price: string;
}

export interface TwilioConference {
  sid: string;
  account_sid: string;
  friendly_name: string;
  status: 'init' | 'in-progress' | 'completed';
  start_time: string | null;
  end_time: string | null;
  duration: string | null;
}

export interface TwilioQueue {
  sid: string;
  account_sid: string;
  friendly_name: string;
  current_size: number;
  max_size: number;
  average_wait_time: number;
}

export interface TwilioAddress {
  sid: string;
  account_sid: string;
  street: string;
  city: string;
  region: string;
  postal_code: string;
  iso_country: string;
}

export interface TwilioKey {
  sid: string;
  account_sid: string;
  friendly_name: string;
  date_created: string;
}

export interface TwilioToken {
  identity: string;
  token: string;
  ttl: number;
}

const MANIFEST: PluginManifest = {
  id: 'twilio',
  name: 'Twilio',
  version: '1.0.0',
  description: 'Twilio communication integration for SMS, voice calls, and conferencing',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['twilio', 'sms', 'voice', 'call', 'communication'],
};

const SCOPES = [
  'getMessages', 'createMessage', 'getMessage', 'deleteMessage',
  'getCalls', 'createCall', 'getCall', 'deleteCall', 'hangupCall',
  'getRecordings', 'getRecording', 'deleteRecording',
  'getConferences', 'getConference', 'createConference',
  'getQueues', 'getQueue', 'createQueue', 'deleteQueue',
  'getAddresses', 'createAddress', 'deleteAddress',
  'getKeys', 'createKey', 'deleteKey',
  'getTokens', 'createToken',
  'getUsageRecords', 'getUsageRecord',
  'getAccounts', 'getAccount', 'updateAccount',
  'getApplications', 'createApplication', 'updateApplication', 'deleteApplication',
  'getCallsLogs', 'getMessagesLogs',
  'getAvailablePhoneNumbers', 'searchAvailablePhoneNumbers',
  'purchasePhoneNumber', 'releasePhoneNumber',
  'getConferenceParticipants', 'muteConferenceParticipant', 'kickConferenceParticipant',
  'getCallFeedback', 'getCallFeedbackSummary',
  'getTranscription', 'getTranscriptions',
  'createWebhook', 'getWebhooks', 'deleteWebhook',
];

export default class TwilioIntegration extends IntegrationBase {
  private apiBase = 'https://api.twilio.com/2010-04-01';
  private accountSid: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['message_sent', 'message_received', 'call_completed', 'call_incoming', 'recording_completed'],
      dataModels: ['message', 'call', 'recording', 'conference', 'queue', 'address', 'key'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken || !config.clientId) {
      throw new Error('Account SID and auth token are required');
    }
    this.setAccessToken(config.accessToken);
    this.accountSid = config.clientId;

    try {
      const account = await this.apiCall<{ sid: string }>(`${this.apiBase}/Accounts/${config.clientId}.json`, {
        headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.accessToken}`).toString('base64')}` },
      });
      return account.sid === config.clientId;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken || !this.accountSid) return false;
    try {
      await this.apiCall(`${this.apiBase}/Accounts/${this.accountSid}.json`, {
        headers: { Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.accessToken}`).toString('base64')}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return { Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.accessToken}`).toString('base64')}` };
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken || !this.accountSid) throw new Error('Not authenticated');
    const headers = this.getAuthHeaders();
    const base = `${this.apiBase}/Accounts/${this.accountSid}`;

    switch (action) {
      case 'getMessages':
        return this.apiCall<{ messages: TwilioMessage[] }>(`${base}/Messages.json`, { headers });
      case 'createMessage':
        return this.apiCall<TwilioMessage>(`${base}/Messages.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ To: params.to, From: params.from, Body: params.body }),
        });
      case 'getMessage':
        return this.apiCall<TwilioMessage>(`${base}/Messages/${params.messageSid}.json`, { headers });
      case 'getCalls':
        return this.apiCall<{ calls: TwilioCall[] }>(`${base}/Calls.json`, { headers });
      case 'createCall':
        return this.apiCall<TwilioCall>(`${base}/Calls.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ To: params.to, From: params.from, Url: params.url, Method: params.method }),
        });
      case 'getCall':
        return this.apiCall<TwilioCall>(`${base}/Calls/${params.callSid}.json`, { headers });
      case 'hangupCall':
        return this.apiCall<TwilioCall>(`${base}/Calls/${params.callSid}.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ Status: 'completed' }),
        });
      case 'getRecordings':
        return this.apiCall<{ recordings: TwilioRecording[] }>(`${base}/Recordings.json`, { headers });
      case 'getRecording':
        return this.apiCall<TwilioRecording>(`${base}/Recordings/${params.recordingSid}.json`, { headers });
      case 'getConferences':
        return this.apiCall<{ conferences: TwilioConference[] }>(`${base}/Conferences.json`, { headers });
      case 'createConference':
        return this.apiCall<TwilioConference>(`${base}/Conferences.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ FriendlyName: params.friendlyName }),
        });
      case 'getQueues':
        return this.apiCall<{ queues: TwilioQueue[] }>(`${base}/Queues.json`, { headers });
      case 'createQueue':
        return this.apiCall<TwilioQueue>(`${base}/Queues.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ FriendlyName: params.friendlyName, MaxSize: params.maxSize }),
        });
      case 'getKeys':
        return this.apiCall<{ keys: TwilioKey[] }>(`${base}/Keys.json`, { headers });
      case 'createKey':
        return this.apiCall<TwilioKey>(`${base}/Keys.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ FriendlyName: params.friendlyName }),
        });
      case 'getTokens':
        return this.apiCall<TwilioToken>(`${base}/Tokens.json`, {
          method: 'POST',
          headers,
        });
      case 'getUsageRecords':
        return this.apiCall(`${base}/Usage/Records.json`, { headers });
      case 'getApplications':
        return this.apiCall(`${base}/Applications.json`, { headers });
      case 'createApplication':
        return this.apiCall(`${base}/Applications.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ FriendlyName: params.friendlyName, VoiceUrl: params.voiceUrl }),
        });
      case 'getAvailablePhoneNumbers':
        return this.apiCall(`https://api.twilio.com/2010-04-01/AvailablePhoneNumbers/${params.countryCode}.json`, { headers });
      case 'purchasePhoneNumber':
        return this.apiCall(`${base}/IncomingPhoneNumbers.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ PhoneNumber: params.phoneNumber }),
        });
      case 'getConferenceParticipants':
        return this.apiCall(`${base}/Conferences/${params.conferenceSid}/Participants.json`, { headers });
      case 'muteConferenceParticipant':
        return this.apiCall(`${base}/Conferences/${params.conferenceSid}/Participants/${params.participantSid}.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ Muted: 'true' }),
        });
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'messages': return this.executeAction('getMessages', options || {});
      case 'calls': return this.executeAction('getCalls', options || {});
      case 'recordings': return this.executeAction('getRecordings', options || {});
      case 'conferences': return this.executeAction('getConferences', options || {});
      case 'queues': return this.executeAction('getQueues', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.accountSid = null;
  }

  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createTwilioIntegration(): TwilioIntegration { return new TwilioIntegration(); }