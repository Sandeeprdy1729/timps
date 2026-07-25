import { Plugin } from '../types';

export { createGoogleCalendarIntegration } from './google-calendar';
export { createGoogleGmailIntegration } from './google-gmail';
export { createGoogleDriveIntegration } from './google-drive';
export { createMicrosoftOutlookIntegration } from './microsoft-outlook';
export { createMicrosoftTeamsIntegration } from './microsoft-teams';
export { createSlackIntegration } from './slack';
export { DiscordNewIntegration, createDiscordNewIntegration, createDiscordSettingsUI, createDiscordActivityCard, setupDiscordTriggers } from './discord-new';
export { createGitHubIntegration } from './github';
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

export const INTEGRATIONS: Plugin[] = [
  require('./google-calendar').createGoogleCalendarIntegration(),
  require('./google-gmail').createGoogleGmailIntegration(),
  require('./google-drive').createGoogleDriveIntegration(),
  require('./microsoft-outlook').createMicrosoftOutlookIntegration(),
  require('./microsoft-teams').createMicrosoftTeamsIntegration(),
  require('./slack').createSlackIntegration(),
  require('./discord-new').createDiscordNewIntegration(),
  require('./github').createGitHubIntegration(),
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
