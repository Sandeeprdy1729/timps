import { BasePlugin, PluginResult, PluginConfig } from './base';

export class SlackNotifierPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('slack-notifier', 'Slack Notifier', config);
  }

  getDescription(): string {
    return 'Send notifications to Slack channels';
  }

  async run(): Promise<PluginResult> {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL || this.config?.params?.webhookUrl;

      if (!webhookUrl) {
        return {
          success: false,
          error: 'No Slack webhook URL configured. Set SLACK_WEBHOOK_URL env var or pass params.webhookUrl',
        };
      }

      const message = this.config?.params?.message || 'Notification from TIMPS Marketplace Plugin';
      const channel = this.config?.params?.channel || '#general';

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          text: message,
          username: 'TIMPS Marketplace',
          icon_emoji: ':robot_face:',
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Slack API returned ${response.status}` };
      }

      return {
        success: true,
        output: `Notification sent to ${channel}`,
        data: { channel, messageLength: message.length },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to send Slack notification' };
    }
  }
}
