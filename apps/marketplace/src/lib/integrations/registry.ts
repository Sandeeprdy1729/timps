import { BaseIntegration, IntegrationConfig } from './base';
import { GitHubIntegration } from './github';
import { SlackIntegration } from './slack';
import { OpenAIIntegration } from './openai';
import { LinearIntegration } from './linear';
import { NotionIntegration } from './notion';
import { VercelIntegration } from './vercel';
import { StripeIntegration } from './stripe';
import { JiraIntegration } from './jira';
import { SalesforceIntegration } from './salesforce';
import { DatadogIntegration } from './datadog';
import { SentryIntegration } from './sentry';
import { HubSpotIntegration } from './hubspot';

const integrationConstructors: Record<string, new (config?: IntegrationConfig) => BaseIntegration> = {
  github: GitHubIntegration,
  slack: SlackIntegration,
  openai: OpenAIIntegration,
  linear: LinearIntegration,
  notion: NotionIntegration,
  vercel: VercelIntegration,
  stripe: StripeIntegration,
  jira: JiraIntegration,
  salesforce: SalesforceIntegration,
  datadog: DatadogIntegration,
  sentry: SentryIntegration,
  hubspot: HubSpotIntegration,
};

export function getIntegration(id: string, config?: IntegrationConfig): BaseIntegration | null {
  const Constructor = integrationConstructors[id];
  if (!Constructor) return null;
  return new Constructor(config);
}

export function getAllIntegrationIds(): string[] {
  return Object.keys(integrationConstructors);
}
