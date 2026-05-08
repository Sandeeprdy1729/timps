import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  splash: string | null;
  discovery_splash: string | null;
  owner_id: string;
  region: string;
  afl: string;
  preferred_locale: string;
  public_guild: boolean;
  premium_tier: number;
  premium_subscription_count: number;
  vanity_url_code: string | null;
}

export interface DiscordChannel {
  id: string;
  type: number;
  guild_id: string | null;
  name: string;
  position: number;
  parent_id: string | null;
  topic: string | null;
  nsfw: boolean;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  author: DiscordUser;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  attachments: DiscordAttachment[];
  embeds: DiscordEmbed[];
  mentions: DiscordUser[];
  mention_roles: string[];
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  bot: boolean;
}

export interface DiscordMember {
  user: DiscordUser;
  nick: string | null;
  roles: string[];
  joined_at: string;
  premium_since: string | null;
  deaf: boolean;
  mute: boolean;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
}

export interface DiscordWebhook {
  id: string;
  guild_id: string;
  channel_id: string;
  name: string | null;
  avatar: string | null;
  token: string;
}

export interface DiscordEmoji {
  id: string;
  name: string;
  roles: string[];
  require_colons: boolean;
  managed: boolean;
  animated: boolean;
}

export interface DiscordInvite {
  code: string;
  guild: DiscordGuild;
  channel: { id: string; name: string; type: number };
  inviter: DiscordUser;
  target_user: DiscordUser;
  target_user_type: number;
}

export interface DiscordGuildTemplate {
  code: string;
  name: string;
  description: string | null;
  usage_count: number;
  creator_id: string;
}

export interface DiscordSticker {
  id: string;
  pack_id: string;
  name: string;
  tags: string;
  type: number;
  format_type: number;
  description: string;
  asset: string;
}

export interface DiscordAuditLog {
  entries: DiscordAuditLogEntry[];
}

export interface DiscordAuditLogEntry {
  id: string;
  target_id: string;
  changes: unknown[];
  user_id: string;
  action_type: number;
  options: unknown[];
  reason: string;
}

export interface DiscordScheduledEvent {
  id: string;
  guild_id: string;
  channel_id: string;
  name: string;
  privacy_level: number;
  scheduled_start_time: string;
  scheduled_end_time: string;
  description: string;
  entity_type: number;
  status: number;
}

const MANIFEST: PluginManifest = {
  id: 'discord',
  name: 'Discord',
  version: '1.0.0',
  description: 'Discord integration for servers, channels, messages, and bot automation',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['discord', 'messaging', 'chat', 'bot'],
};

const SCOPES = [
  'getGuild', 'getGuilds', 'createGuild', 'deleteGuild', 'updateGuild', 'getGuildVanityUrl', 'getGuildPreview', 'getGuildWidget',
  'createGuildFromTemplate', 'getGuildTemplates', 'createGuildTemplate', 'deleteGuildTemplate',
  'getChannels', 'getChannel', 'createChannel', 'updateChannel', 'deleteChannel', 'updateChannelPositions',
  'getMessages', 'getMessage', 'createMessage', 'editMessage', 'deleteMessage', 'bulkDeleteMessages', 'crosspostMessage',
  'getPinnedMessages', 'pinMessage', 'unpinMessage',
  'getReactions', 'createReaction', 'deleteReaction', 'deleteAllReactions', 'deleteUserReaction',
  'getInvites', 'createInvite', 'deleteInvite', 'getVanityUrl',
  'getRoles', 'getRole', 'createRole', 'updateRole', 'deleteRole', 'updateRolePositions',
  'getMembers', 'getMember', 'updateMember', 'removeMember', 'updateMemberRoles', 'banMember', 'unbanMember', 'getBans',
  'getMFA', 'createMFALevel', 'getWebhooks', 'createWebhook', 'getWebhook', 'executeWebhook', 'deleteWebhook', 'editWebhookMessage', 'deleteWebhookMessage',
  'getEmojis', 'getEmoji', 'createEmoji', 'updateEmoji', 'deleteEmoji',
  'getStickers', 'getSticker', 'createSticker', 'deleteSticker',
  'getAuditLogs', 'getGuildWidgetSettings', 'updateGuildWidgetSettings',
  'getScheduledEvents', 'getScheduledEvent', 'createScheduledEvent', 'updateScheduledEvent', 'deleteScheduledEvent', 'getGuildScheduledEventUsers',
  'getIntegrations', 'createIntegration', 'deleteIntegration',
  'createApplicationCommand', 'getApplicationCommands', 'editApplicationCommand', 'deleteApplicationCommand', 'getApplicationCommandPermissions',
  'createInteractionResponse', 'getOriginalInteractionResponse', 'editOriginalInteractionResponse', 'deleteOriginalInteractionResponse',
  'createFollowupMessage', 'getFollowupMessage', 'editFollowupMessage', 'deleteFollowupMessage',
];

export default class DiscordIntegration extends IntegrationBase {
  private apiBase = 'https://discord.com/api/v10';
  private guildId: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['message_created', 'message_updated', 'message_deleted', 'channel_created', 'channel_updated', 'guildMemberAdded', 'guildMemberRemoved', 'guildBanAdded', 'guildBanRemoved', 'role_created', 'role_deleted', 'emoji_created', 'emoji_deleted', 'sticker_created', 'sticker_deleted'],
      dataModels: ['guild', 'channel', 'message', 'member', 'role', 'webhook', 'emoji', 'invite', 'sticker', 'scheduled_event', 'audit_log'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Bot token is required');
    this.setAccessToken(config.accessToken);

    try {
      const response = await fetch(`${this.apiBase}/users/@me`, {
        headers: { Authorization: `Bot ${config.accessToken}` },
      });
      return response.ok;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      const response = await fetch(`${this.apiBase}/users/@me`, {
        headers: { Authorization: `Bot ${this.accessToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return { Authorization: `Bot ${this.accessToken}` };
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const headers = this.getAuthHeaders();

    switch (action) {
      case 'getGuilds':
        return this.apiCall<{ guilds: DiscordGuild[] }>(`${this.apiBase}/users/@me/guilds`, { headers });

      case 'getGuild':
        return this.apiCall<DiscordGuild>(`${this.apiBase}/guilds/${params.guildId}`, { headers });

      case 'createGuild':
        return this.apiCall<DiscordGuild>(`${this.apiBase}/guilds`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.guild),
        });

      case 'deleteGuild':
        return this.apiCall(`${this.apiBase}/guilds/${params.guildId}`, {
          method: 'DELETE',
          headers,
        });

      case 'updateGuild':
        return this.apiCall<DiscordGuild>(`${this.apiBase}/guilds/${params.guildId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'getGuildVanityUrl':
        return this.apiCall<{ code: string; uses: number }>(`${this.apiBase}/guilds/${params.guildId}/vanity-url`, { headers });

      case 'getChannels':
        return this.apiCall<{ channels: DiscordChannel[] }>(`${this.apiBase}/guilds/${params.guildId}/channels`, { headers });

      case 'getChannel':
        return this.apiCall<DiscordChannel>(`${this.apiBase}/channels/${params.channelId}`, { headers });

      case 'createChannel':
        return this.apiCall<DiscordChannel>(`${this.apiBase}/guilds/${params.guildId}/channels`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.channel),
        });

      case 'updateChannel':
        return this.apiCall<DiscordChannel>(`${this.apiBase}/channels/${params.channelId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteChannel':
        return this.apiCall(`${this.apiBase}/channels/${params.channelId}`, {
          method: 'DELETE',
          headers,
        });

      case 'getMessages':
        return this.apiCall<{ messages: DiscordMessage[] }>(`${this.apiBase}/channels/${params.channelId}/messages?limit=${params.limit || 50}`, { headers });

      case 'getMessage':
        return this.apiCall<DiscordMessage>(`${this.apiBase}/channels/${params.channelId}/messages/${params.messageId}`, { headers });

      case 'createMessage':
        return this.apiCall<DiscordMessage>(`${this.apiBase}/channels/${params.channelId}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: params.content,
            embed: params.embed,
            embeds: params.embeds,
            components: params.components,
          }),
        });

      case 'editMessage':
        return this.apiCall<DiscordMessage>(`${this.apiBase}/channels/${params.channelId}/messages/${params.messageId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteMessage':
        return this.apiCall(`${this.apiBase}/channels/${params.channelId}/messages/${params.messageId}`, {
          method: 'DELETE',
          headers,
        });

      case 'bulkDeleteMessages':
        return this.apiCall(`${this.apiBase}/channels/${params.channelId}/messages/bulk-delete`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages: params.messageIds }),
        });

      case 'getPinnedMessages':
        return this.apiCall<{ messages: DiscordMessage[] }>(`${this.apiBase}/channels/${params.channelId}/pins`, { headers });

      case 'pinMessage':
        return this.apiCall(`${this.apiBase}/channels/${params.channelId}/pins/${params.messageId}`, {
          method: 'PUT',
          headers,
        });

      case 'unpinMessage':
        return this.apiCall(`${this.apiBase}/channels/${params.channelId}/pins/${params.messageId}`, {
          method: 'DELETE',
          headers,
        });

      case 'createReaction':
        return this.apiCall(`${this.apiBase}/channels/${params.channelId}/messages/${params.messageId}/reactions/${params.emoji}/${params.userId || '@me'}`, {
          method: 'PUT',
          headers,
        });

      case 'deleteReaction':
        return this.apiCall(`${this.apiBase}/channels/${params.channelId}/messages/${params.messageId}/reactions/${params.emoji}/${params.userId || '@me'}`, {
          method: 'DELETE',
          headers,
        });

      case 'deleteAllReactions':
        return this.apiCall(`${this.apiBase}/channels/${params.channelId}/messages/${params.messageId}/reactions`, {
          method: 'DELETE',
          headers,
        });

      case 'getRoles':
        return this.apiCall<{ roles: DiscordRole[] }>(`${this.apiBase}/guilds/${params.guildId}/roles`, { headers });

      case 'createRole':
        return this.apiCall<DiscordRole>(`${this.apiBase}/guilds/${params.guildId}/roles`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.role),
        });

      case 'updateRole':
        return this.apiCall<DiscordRole>(`${this.apiBase}/guilds/${params.guildId}/roles/${params.roleId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteRole':
        return this.apiCall(`${this.apiBase}/guilds/${params.guildId}/roles/${params.roleId}`, {
          method: 'DELETE',
          headers,
        });

      case 'getMembers':
        return this.apiCall<{ members: DiscordMember[] }>(`${this.apiBase}/guilds/${params.guildId}/members?limit=${params.limit || 1000}`, { headers });

      case 'getMember':
        return this.apiCall<DiscordMember>(`${this.apiBase}/guilds/${params.guildId}/members/${params.userId}`, { headers });

      case 'updateMember':
        return this.apiCall<DiscordMember>(`${this.apiBase}/guilds/${params.guildId}/members/${params.userId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'removeMember':
        return this.apiCall(`${this.apiBase}/guilds/${params.guildId}/members/${params.userId}`, {
          method: 'DELETE',
          headers,
        });

      case 'updateMemberRoles':
        return this.apiCall<DiscordMember>(`${this.apiBase}/guilds/${params.guildId}/members/${params.userId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ roles: params.roles }),
        });

      case 'banMember':
        return this.apiCall(`${this.apiBase}/guilds/${params.guildId}/bans/${params.userId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ reason: params.reason, delete_message_days: params.deleteMessageDays }),
        });

      case 'unbanMember':
        return this.apiCall(`${this.apiBase}/guilds/${params.guildId}/bans/${params.userId}`, {
          method: 'DELETE',
          headers,
        });

      case 'getInvites':
        return this.apiCall<{ invites: DiscordInvite[] }>(`${this.apiBase}/guilds/${params.guildId}/invites`, { headers });

      case 'createInvite':
        return this.apiCall<DiscordInvite>(`${this.apiBase}/channels/${params.channelId}/invites`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.invite),
        });

      case 'getWebhooks':
        return this.apiCall<{ webhooks: DiscordWebhook[] }>(`${this.apiBase}/guilds/${params.guildId}/webhooks`, { headers });

      case 'createWebhook':
        return this.apiCall<DiscordWebhook>(`${this.apiBase}/channels/${params.channelId}/webhooks`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.webhook),
        });

      case 'executeWebhook':
        return this.apiCall(`${this.apiBase}/webhooks/${params.webhookId}/${params.token}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: params.content,
            embeds: params.embeds,
            components: params.components,
          }),
        });

      case 'getEmojis':
        return this.apiCall<{ emojis: DiscordEmoji[] }>(`${this.apiBase}/guilds/${params.guildId}/emojis`, { headers });

      case 'createEmoji':
        return this.apiCall<DiscordEmoji>(`${this.apiBase}/guilds/${params.guildId}/emojis`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.emoji),
        });

      case 'deleteEmoji':
        return this.apiCall(`${this.apiBase}/guilds/${params.guildId}/emojis/${params.emojiId}`, {
          method: 'DELETE',
          headers,
        });

      case 'getStickers':
        return this.apiCall<{ stickers: DiscordSticker[] }>(`${this.apiBase}/guilds/${params.guildId}/stickers`, { headers });

      case 'getAuditLogs':
        return this.apiCall<DiscordAuditLog>(`${this.apiBase}/guilds/${params.guildId}/audit-logs`, { headers });

      case 'getScheduledEvents':
        return this.apiCall<{ scheduled_events: DiscordScheduledEvent[] }>(`${this.apiBase}/guilds/${params.guildId}/scheduled-events`, { headers });

      case 'createScheduledEvent':
        return this.apiCall<DiscordScheduledEvent>(`${this.apiBase}/guilds/${params.guildId}/scheduled-events`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.scheduledEvent),
        });

      case 'updateScheduledEvent':
        return this.apiCall<DiscordScheduledEvent>(`${this.apiBase}/guilds/${params.guildId}/scheduled-events/${params.eventId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteScheduledEvent':
        return this.apiCall(`${this.apiBase}/guilds/${params.guildId}/scheduled-events/${params.eventId}`, {
          method: 'DELETE',
          headers,
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'guilds':
        return this.executeAction('getGuilds', options || {});
      case 'channels':
        return this.executeAction('getChannels', { guildId: options?.guildId });
      case 'messages':
        return this.executeAction('getMessages', options || {});
      case 'roles':
        return this.executeAction('getRoles', { guildId: options?.guildId });
      case 'members':
        return this.executeAction('getMembers', { guildId: options?.guildId });
      case 'invites':
        return this.executeAction('getInvites', { guildId: options?.guildId });
      case 'emojis':
        return this.executeAction('getEmojis', { guildId: options?.guildId });
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.guildId = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createDiscordIntegration(): DiscordIntegration {
  return new DiscordIntegration();
}