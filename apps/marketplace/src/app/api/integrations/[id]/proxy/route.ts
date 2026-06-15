import { NextRequest, NextResponse } from 'next/server';
import { getCredentials } from '@/lib/credentials';
import { getIntegration } from '@/lib/integrations/registry';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const creds = getCredentials(id);

    if (!creds) {
      return NextResponse.json(
        { error: 'Integration not connected. Connect first.' },
        { status: 401 }
      );
    }

    const integration = getIntegration(id, creds);
    if (!integration) {
      return NextResponse.json(
        { error: `Unknown integration: ${id}` },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, ...args } = body;

    const gh = integration as import('@/lib/integrations/github').GitHubIntegration;
    let result;

    switch (id) {
      case 'github': {
        switch (action) {
          case 'getUser': result = await gh.getUser(); break;
          case 'getRepo': result = await gh.getRepo(args.owner, args.repo); break;
          case 'listIssues': result = await gh.listIssues(args.owner, args.repo, args.state); break;
          case 'createIssue': result = await gh.createIssue(args.owner, args.repo, args.title, args.body); break;
          case 'listPRs': result = await gh.listPRs(args.owner, args.repo, args.state); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'slack': {
        const slack = integration as import('@/lib/integrations/slack').SlackIntegration;
        switch (action) {
          case 'sendMessage': result = await slack.sendMessage(args.channel, args.text); break;
          case 'listChannels': result = await slack.listChannels(args.limit); break;
          case 'getChannelHistory': result = await slack.getChannelHistory(args.channel, args.limit); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'openai': {
        const oai = integration as import('@/lib/integrations/openai').OpenAIIntegration;
        switch (action) {
          case 'generateCompletion': result = await oai.generateCompletion(args.prompt, args.model); break;
          case 'generateCode': result = await oai.generateCode(args.prompt); break;
          case 'reviewCode': result = await oai.reviewCode(args.code); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'linear': {
        const lin = integration as import('@/lib/integrations/linear').LinearIntegration;
        switch (action) {
          case 'listTeams': result = await lin.listTeams(); break;
          case 'createIssue': result = await lin.createIssue(args.teamId, args.title, args.description); break;
          case 'listIssues': result = await lin.listIssues(args.teamId); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'notion': {
        const not = integration as import('@/lib/integrations/notion').NotionIntegration;
        switch (action) {
          case 'listDatabases': result = await not.listDatabases(); break;
          case 'createPage': result = await not.createPage(args.databaseId, args.title, args.properties); break;
          case 'getDatabase': result = await not.getDatabase(args.databaseId); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'vercel': {
        const ver = integration as import('@/lib/integrations/vercel').VercelIntegration;
        switch (action) {
          case 'listDeployments': result = await ver.listDeployments(args.limit); break;
          case 'getDeployment': result = await ver.getDeployment(args.id); break;
          case 'getProjects': result = await ver.getProjects(); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'stripe': {
        const str = integration as import('@/lib/integrations/stripe').StripeIntegration;
        switch (action) {
          case 'listCustomers': result = await str.listCustomers(args.limit); break;
          case 'listProducts': result = await str.listProducts(args.limit); break;
          case 'listSubscriptions': result = await str.listSubscriptions(args.limit); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'jira': {
        const jira = integration as import('@/lib/integrations/jira').JiraIntegration;
        switch (action) {
          case 'listProjects': result = await jira.listProjects(); break;
          case 'createIssue': result = await jira.createIssue(args.projectKey, args.summary, args.issueType, args.description); break;
          case 'searchIssues': result = await jira.searchIssues(args.jql); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'salesforce': {
        const sf = integration as import('@/lib/integrations/salesforce').SalesforceIntegration;
        switch (action) {
          case 'query': result = await sf.query(args.soql); break;
          case 'describeObject': result = await sf.describeObject(args.objectName); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'datadog': {
        const dd = integration as import('@/lib/integrations/datadog').DatadogIntegration;
        switch (action) {
          case 'listMonitors': result = await dd.listMonitors(); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'sentry': {
        const sn = integration as import('@/lib/integrations/sentry').SentryIntegration;
        switch (action) {
          case 'listProjects': result = await sn.listProjects(); break;
          case 'listIssues': result = await sn.listIssues(args.orgSlug, args.projectSlug); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      case 'hubspot': {
        const hs = integration as import('@/lib/integrations/hubspot').HubSpotIntegration;
        switch (action) {
          case 'listContacts': result = await hs.listContacts(args.limit); break;
          case 'listDeals': result = await hs.listDeals(args.limit); break;
          default: result = { success: false, error: `Unknown action: ${action}` };
        }
        break;
      }
      default:
        result = { success: false, error: `Unknown integration: ${id}` };
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Proxy request failed' },
      { status: 500 }
    );
  }
}
