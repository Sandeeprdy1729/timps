import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig, createIntegration } from './integration-base.js';

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  all_members_are_administrators?: boolean;
  photo?: TelegramChatPhoto;
  description?: string;
  invite_link?: string;
  pinned_message?: TelegramMessage;
  sticker_set_name?: string;
  can_set_sticker_set?: boolean;
}

export interface TelegramChatPhoto {
  small_file_id: string;
  big_file_id: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_from_message_id?: number;
  forward_signature?: string;
  forward_sender_name?: string;
  forward_date?: number;
  reply_to_message?: TelegramMessage;
  edit_date?: number;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  entities?: TelegramMessageEntity[];
  animation?: TelegramAnimation;
  audio?: TelegramAudio;
  document?: TelegramDocument;
  photo?: TelegramPhotoSize[];
  sticker?: TelegramSticker;
  video?: TelegramVideo;
  video_note?: TelegramVideoNote;
  voice?: TelegramVoice;
  caption?: string;
  caption_entities?: TelegramMessageEntity[];
  contact?: TelegramContact;
  dice?: TelegramDice;
  game?: TelegramGame;
  invoice?: TelegramInvoice;
  location?: TelegramLocation;
  new_chat_members?: TelegramUser[];
  new_chat_title?: string;
  new_chat_photo?: TelegramPhotoSize[];
  left_chat_member?: TelegramUser;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  pinned_message?: TelegramMessage;
}

export interface TelegramMessageEntity {
  type: 'mention' | 'hashtag' | 'bot_command' | 'url' | 'email' | 'bold' | 'italic' | 'code' | 'pre' | 'text_link' | 'text_mention' | 'cashtag' | 'phone_number';
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  is_animated: boolean;
  thumb?: TelegramPhotoSize;
  emoji?: string;
  set_name?: string;
  mask_position?: TelegramMaskPosition;
  file_size?: number;
}

export interface TelegramMaskPosition {
  point: 'forehead' | 'eyes' | 'mouth' | 'chin';
  x_shift: number;
  y_shift: number;
  scale: number;
}

export interface TelegramVideoNote {
  file_id: string;
  file_unique_id: string;
  length: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  file_size?: number;
}

export interface TelegramAnimation {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
}

export interface TelegramDice {
  emoji: string;
  value: number;
}

export interface TelegramGame {
  game_id: string;
  title: string;
  description: string;
  photo?: TelegramPhotoSize[];
  text?: string;
  text_entities?: TelegramMessageEntity[];
  animation?: TelegramAnimation;
}

export interface TelegramInvoice {
  title: string;
  description: string;
  start_parameter: string;
  currency: string;
  total_amount: number;
}

export interface TelegramLocation {
  longitude: number;
  latitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

export interface TelegramBotCommand {
  command: string;
  description: string;
}

export interface TelegramBotDescription {
  description: string;
}

export interface TelegramBotName {
  name: string;
}

export interface TelegramChatPermissions {
  can_send_messages?: boolean;
  can_send_media_messages?: boolean;
  can_send_polls?: boolean;
  can_send_other_messages?: boolean;
  can_add_web_page_previews?: boolean;
  can_change_info?: boolean;
  can_invite_users?: boolean;
  can_pin_messages?: boolean;
}

export interface TelegramChatLocation {
  location: TelegramLocation;
  address: string;
}

export interface TelegramMenuButton {
  type: 'commands' | 'web_app' | 'default';
  text?: string;
  web_app?: { url: string };
}

const MANIFEST: PluginManifest = {
  id: 'telegram',
  name: 'Telegram',
  version: '1.0.0',
  description: 'Telegram messaging integration for sending messages, managing chats, and handling webhooks',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['messaging', 'telegram', 'chat', 'bot'],
};

const SCOPES = [
  'sendMessage',
  'getUpdates',
  'getChat',
  'getChatAdministrators',
  'getChatMember',
  'getChatMembersCount',
  'getMe',
  'getMyCommands',
  'setMyCommands',
  'getMyDescription',
  'setMyDescription',
  'getMyName',
  'setMyName',
  'getMyDescription',
  'setMyDescription',
  'exportChatInviteLink',
  'createChatInviteLink',
  'editChatInviteLink',
  'revokeChatInviteLink',
  'approveChatJoinRequest',
  'declineChatJoinRequest',
  'kickChatMember',
  'unbanChatMember',
  'restrictChatMember',
  'promoteChatMember',
  'setChatPermissions',
  'setChatPhoto',
  'deleteChatPhoto',
  'setChatTitle',
  'setChatDescription',
  'pinChatMessage',
  'unpinChatMessage',
  'forwardMessage',
  'copyMessage',
  'sendPhoto',
  'sendAudio',
  'sendDocument',
  'sendSticker',
  'sendVideo',
  'sendAnimation',
  'sendVoice',
  'sendVideoNote',
  'sendMediaGroup',
  'sendLocation',
  'editMessageLiveLocation',
  'stopMessageLiveLocation',
  'sendVenue',
  'sendContact',
  'sendInvoice',
  'sendGame',
  'sendChatAction',
  'answerInlineQuery',
  'answerCallbackQuery',
  'answerInlineQuery',
  'setChatMenuButton',
  'getChatMenuButton',
  'editMessageText',
  'editMessageCaption',
  'editMessageMedia',
  'editMessageReplyMarkup',
  'stopPoll',
  'deleteMessage',
];

export default class TelegramIntegration extends IntegrationBase {
  private apiBase = 'https://api.telegram.org';
  private webhookEndpoint: string | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private lastUpdateId = 0;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: [
        'message',
        'edited_message',
        'channel_post',
        'edited_channel_post',
        'callback_query',
        'inline_query',
        'chosen_inline_result',
        'chat_join_request',
      ],
      dataModels: ['chat', 'user', 'message', 'update'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.apiKey) {
      throw new Error('Bot token (apiKey) is required');
    }
    this.setApiKey(config.apiKey);

    try {
      const bot = await this.apiCall<TelegramUser>(`${this.apiBase}/bot${config.apiKey}/getMe`);
      console.log('Authenticated as:', bot.username);
      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.apiCall<{ ok: boolean }>(`${this.apiBase}/bot${this.apiKey}/getMe`);
      return true;
    } catch {
      return false;
    }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.apiKey) throw new Error('Not authenticated');

    const endpoint = `${this.apiBase}/bot${this.apiKey}`;

    switch (action) {
      case 'sendMessage':
        return this.apiCall<TelegramMessage>(`${endpoint}/sendMessage`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            text: params.text,
            parse_mode: params.parseMode || 'Markdown',
            disable_web_page_preview: params.disableWebPagePreview,
            disable_notification: params.disableNotification,
            reply_to_message_id: params.replyToMessageId,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'sendPhoto':
        return this.apiCall<TelegramMessage>(`${endpoint}/sendPhoto`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            photo: params.photo,
            caption: params.caption,
            parse_mode: params.parseMode,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'sendDocument':
        return this.apiCall<TelegramMessage>(`${endpoint}/sendDocument`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            document: params.document,
            caption: params.caption,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'sendSticker':
        return this.apiCall<TelegramMessage>(`${endpoint}/sendSticker`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            sticker: params.sticker,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'sendVideo':
        return this.apiCall<TelegramMessage>(`${endpoint}/sendVideo`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            video: params.video,
            caption: params.caption,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'sendAnimation':
        return this.apiCall<TelegramMessage>(`${endpoint}/sendAnimation`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            animation: params.animation,
            caption: params.caption,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'sendVoice':
        return this.apiCall<TelegramMessage>(`${endpoint}/sendVoice`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            voice: params.voice,
            caption: params.caption,
            duration: params.duration,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'sendLocation':
        return this.apiCall<TelegramMessage>(`${endpoint}/sendLocation`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            latitude: params.latitude,
            longitude: params.longitude,
            horizontal_accuracy: params.horizontalAccuracy,
            live_period: params.livePeriod,
            heading: params.heading,
            proximity_alert_radius: params.proximityAlertRadius,
          }),
        });

      case 'sendVenue':
        return this.apiCall<TelegramMessage>(`${endpoint}/sendVenue`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            latitude: params.latitude,
            longitude: params.longitude,
            title: params.title,
            address: params.address,
            foursquare_id: params.foursquareId,
            foursquare_type: params.foursquareType,
          }),
        });

      case 'sendContact':
        return this.apiCall<TelegramMessage>(`${endpoint}/sendContact`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            phone_number: params.phoneNumber,
            first_name: params.firstName,
            last_name: params.lastName,
            vcard: params.vcard,
          }),
        });

      case 'sendChatAction':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/sendChatAction`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            action: params.action,
          }),
        });

      case 'getChat':
        return this.apiCall<TelegramChat>(`${endpoint}/getChat`, {
          method: 'POST',
          body: JSON.stringify({ chat_id: params.chatId }),
        });

      case 'getChatAdministrators':
        return this.apiCall<{ ok: boolean; result: TelegramUser[] }>(`${endpoint}/getChatAdministrators`, {
          method: 'POST',
          body: JSON.stringify({ chat_id: params.chatId }),
        });

      case 'getChatMember':
        return this.apiCall<{ ok: boolean; result: { status: string; user: TelegramUser } }>(
          `${endpoint}/getChatMember`,
          {
            method: 'POST',
            body: JSON.stringify({
              chat_id: params.chatId,
              user_id: params.userId,
            }),
          }
        );

      case 'getChatMembersCount':
        return this.apiCall<{ ok: boolean; result: number }>(`${endpoint}/getChatMembersCount`, {
          method: 'POST',
          body: JSON.stringify({ chat_id: params.chatId }),
        });

      case 'getMe':
        return this.apiCall<TelegramUser>(`${endpoint}/getMe`);

      case 'getMyCommands':
        return this.apiCall<{ ok: boolean; result: TelegramBotCommand[] }>(`${endpoint}/getMyCommands`);

      case 'setMyCommands':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/setMyCommands`, {
          method: 'POST',
          body: JSON.stringify({ commands: params.commands }),
        });

      case 'getMyDescription':
        return this.apiCall<{ ok: boolean; result: TelegramBotDescription }>(`${endpoint}/getMyDescription`);

      case 'setMyDescription':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/setMyDescription`, {
          method: 'POST',
          body: JSON.stringify({ description: params.description }),
        });

      case 'exportChatInviteLink':
        return this.apiCall<{ ok: boolean; result: string }>(`${endpoint}/exportChatInviteLink`, {
          method: 'POST',
          body: JSON.stringify({ chat_id: params.chatId }),
        });

      case 'createChatInviteLink':
        return this.apiCall<{ ok: boolean; result: { invite_link: string } }>(`${endpoint}/createChatInviteLink`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            name: params.name,
            expire_date: params.expireDate,
            member_limit: params.memberLimit,
          }),
        });

      case 'editChatInviteLink':
        return this.apiCall<{ ok: boolean; result: { invite_link: string } }>(`${endpoint}/editChatInviteLink`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            invite_link: params.inviteLink,
            name: params.name,
            expire_date: params.expireDate,
            member_limit: params.memberLimit,
          }),
        });

      case 'revokeChatInviteLink':
        return this.apiCall<{ ok: boolean; result: { invite_link: string } }>(`${endpoint}/revokeChatInviteLink`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            invite_link: params.inviteLink,
          }),
        });

      case 'kickChatMember':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/kickChatMember`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            user_id: params.userId,
            until_date: params.untilDate,
          }),
        });

      case 'unbanChatMember':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/unbanChatMember`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            user_id: params.userId,
          }),
        });

      case 'restrictChatMember':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/restrictChatMember`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            user_id: params.userId,
            permissions: params.permissions,
            until_date: params.untilDate,
          }),
        });

      case 'promoteChatMember':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/promoteChatMember`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            user_id: params.userId,
            is_anonymous: params.isAnonymous,
            can_change_info: params.canChangeInfo,
            can_post_messages: params.canPostMessages,
            can_edit_messages: params.canEditMessages,
            can_delete_messages: params.canDeleteMessages,
            can_invite_users: params.canInviteUsers,
            can_restrict_members: params.canRestrictMembers,
            can_pin_messages: params.canPinMessages,
            can_promote_members: params.canPromoteMembers,
          }),
        });

      case 'setChatPermissions':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/setChatPermissions`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            permissions: params.permissions,
          }),
        });

      case 'setChatPhoto':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/setChatPhoto`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            photo: params.photo,
          }),
        });

      case 'deleteChatPhoto':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/deleteChatPhoto`, {
          method: 'POST',
          body: JSON.stringify({ chat_id: params.chatId }),
        });

      case 'setChatTitle':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/setChatTitle`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            title: params.title,
          }),
        });

      case 'setChatDescription':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/setChatDescription`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            description: params.description,
          }),
        });

      case 'pinChatMessage':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/pinChatMessage`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            message_id: params.messageId,
            disable_notification: params.disableNotification,
          }),
        });

      case 'unpinChatMessage':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/unpinChatMessage`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            message_id: params.messageId,
          }),
        });

      case 'forwardMessage':
        return this.apiCall<TelegramMessage>(`${endpoint}/forwardMessage`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            from_chat_id: params.fromChatId,
            message_id: params.messageId,
            disable_notification: params.disableNotification,
          }),
        });

      case 'copyMessage':
        return this.apiCall<{ ok: boolean; result: { message_id: number } }>(`${endpoint}/copyMessage`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            from_chat_id: params.fromChatId,
            message_id: params.messageId,
            caption: params.caption,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'deleteMessage':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/deleteMessage`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            message_id: params.messageId,
          }),
        });

      case 'editMessageText':
        return this.apiCall<TelegramMessage>(`${endpoint}/editMessageText`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            message_id: params.messageId,
            text: params.text,
            parse_mode: params.parseMode,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'editMessageCaption':
        return this.apiCall<TelegramMessage>(`${endpoint}/editMessageCaption`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            message_id: params.messageId,
            caption: params.caption,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'answerCallbackQuery':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/answerCallbackQuery`, {
          method: 'POST',
          body: JSON.stringify({
            callback_query_id: params.callbackQueryId,
            text: params.text,
            show_alert: params.showAlert,
            url: params.url,
            cache_time: params.cacheTime,
          }),
        });

      case 'answerInlineQuery':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/answerInlineQuery`, {
          method: 'POST',
          body: JSON.stringify({
            inline_query_id: params.inlineQueryId,
            results: params.results,
            cache_time: params.cacheTime,
            is_personal: params.isPersonal,
            next_offset: params.nextOffset,
            switch_pm_text: params.switchPmText,
            switch_pm_parameter: params.switchPmParameter,
          }),
        });

      case 'stopPoll':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/stopPoll`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: params.chatId,
            message_id: params.messageId,
            reply_markup: params.replyMarkup,
          }),
        });

      case 'getUpdates':
        return this.apiCall<{ ok: boolean; result: TelegramUpdate[] }>(`${endpoint}/getUpdates`, {
          method: 'POST',
          body: JSON.stringify({
            offset: params.offset || this.lastUpdateId + 1,
            limit: params.limit || 100,
            timeout: params.timeout || 0,
            allowed_updates: params.allowedUpdates,
          }),
        });

      case 'setWebhook':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/setWebhook`, {
          method: 'POST',
          body: JSON.stringify({
            url: params.url,
            certificate: params.certificate,
            max_connections: params.maxConnections,
            allowed_updates: params.allowedUpdates,
            ip_address: params.ipAddress,
          }),
        });

      case 'deleteWebhook':
        return this.apiCall<{ ok: boolean }>(`${endpoint}/deleteWebhook`, {
          method: 'POST',
          body: JSON.stringify({
            drop_pending_updates: params.dropPendingUpdates,
          }),
        });

      case 'getWebhookInfo':
        return this.apiCall<{ ok: boolean; result: { url: string; has_custom_certificate: boolean; pending_update_count: number; ip_address: string; last_error_date: number; last_error_message: string; max_connections: number; allowed_updates: string[] } }>(
          `${endpoint}/getWebhookInfo`
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'updates':
        return this.executeAction('getUpdates', options || {});
      case 'chat':
        return this.executeAction('getChat', { chatId: options?.chatId });
      case 'me':
        return this.executeAction('getMe', {});
      case 'commands':
        return this.executeAction('getMyCommands', {});
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async startPolling(interval: number = 5000): Promise<void> {
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await this.getUpdates();
        for (const update of response.result) {
          this.processUpdate(update);
          this.lastUpdateId = update.update_id;
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, interval);
  }

  async stopPolling(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async getUpdates(): Promise<{ ok: boolean; result: TelegramUpdate[] }> {
    if (!this.apiKey) throw new Error('Not authenticated');
    return this.apiCall(`${this.apiBase}/bot${this.apiKey}/getUpdates`, {
      method: 'POST',
      body: JSON.stringify({ offset: this.lastUpdateId + 1 }),
    });
  }

  private processUpdate(update: TelegramUpdate): void {
    if (update.message) {
      this.emit('message', update.message);
    }
    if (update.edited_message) {
      this.emit('edited_message', update.edited_message);
    }
    if (update.callback_query) {
      this.emit('callback_query', update.callback_query);
    }
  }

  async cleanup(): Promise<void> {
    await this.stopPolling();
    this.apiKey = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createTelegramIntegration(): TelegramIntegration {
  return new TelegramIntegration();
}