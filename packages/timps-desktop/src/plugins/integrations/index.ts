export { GoogleCalendarPlugin, googleCalendarPlugin } from './google-calendar';
export { GoogleGmailPlugin, googleGmailPlugin } from './google-gmail';
export { GoogleDrivePlugin, googleDrivePlugin } from './google-drive';
export { MicrosoftOutlookPlugin, microsoftOutlookPlugin } from './microsoft-outlook';
export { MicrosoftTeamsPlugin, microsoftTeamsPlugin } from './microsoft-teams';
export { SlackPlugin, slackPlugin } from './slack';
export { DiscordPlugin, discordPlugin } from './discord';
export { DiscordNewIntegration, createDiscordNewIntegration, createDiscordSettingsUI, createDiscordActivityCard, setupDiscordTriggers, runE2ETests } from './discord-new';
export { GitHubPlugin, githubPlugin } from './github';
export { FreshdeskPlugin, freshdeskPlugin } from './freshdesk';
export { ClosePlugin, closePlugin } from './close';
export { SendGridPlugin, sendgridPlugin } from './sendgrid';
export { ResendPlugin, resendPlugin } from './resend';
export { WebflowPlugin, webflowPlugin } from './webflow';
export { ContentfulPlugin, contentfulPlugin } from './contentful';
export { SquarePlugin, squarePlugin } from './square';
export { ShopifyPlugin, shopifyPlugin } from './shopify';
export { MondayComPlugin, mondaycomPlugin } from './mondaycom';
export { ServiceNowPlugin, servicenowPlugin } from './servicenow';
export { PipedrivePlugin, pipedrivePlugin } from './pipedrive';
export { SupabaseIntegration, supabasePlugin, createSupabaseIntegration } from './supabase';
export { RaycastPlugin, raycastPlugin, createRaycastSettingsUI, createRaycastActivityCard } from './raycast';
export { HotjarIntegration, hotjarPlugin, createHotjarIntegration, createHotjarSettingsUI, createHotjarRecordingCard, createHeatmapCard, createSurveyCard, createFeedbackCard, generateTrackingCode, generateSurveyTriggerCode, generateFeedbackWidgetCode, generateHeatmapActivationCode, generateIdentifyCode, generateSessionPropertyCode, generateTagCode } from './hotjar';
export {
  OpenAIIntegration,
  openaiPlugin,
  createOpenAIIntegration,
  createOpenAISettingsUI,
  createChatSession,
  createUsageAlert,
  setupOpenAIMonitoring,
  streamChatCompletion,
  calculatePromptCost,
  calculateCompletionCost,
  runE2ETests,
} from './openai';

import { Plugin } from '../types';

export const INTEGRATIONS: Plugin[] = [
  require('./google-calendar').googleCalendarPlugin,
  require('./google-gmail').googleGmailPlugin,
  require('./google-drive').googleDrivePlugin,
  require('./microsoft-outlook').microsoftOutlookPlugin,
  require('./microsoft-teams').microsoftTeamsPlugin,
  require('./slack').slackPlugin,
  require('./discord').discordPlugin,
  require('./discord-new').createDiscordNewIntegration(),
  require('./github').githubPlugin,
  require('./freshdesk').freshdeskPlugin,
  require('./close').closePlugin,
  require('./sendgrid').sendgridPlugin,
  require('./resend').resendPlugin,
  require('./webflow').webflowPlugin,
  require('./contentful').contentfulPlugin,
  require('./square').squarePlugin,
  require('./shopify').shopifyPlugin,
  require('./mondaycom').mondaycomPlugin,
  require('./servicenow').servicenowPlugin,
  require('./pipedrive').pipedrivePlugin,
  require('./supabase').supabasePlugin,
  require('./raycast').raycastPlugin,
  require('./hotjar').hotjarPlugin,
  require('./openai').openaiPlugin,
];

export default INTEGRATIONS;