import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface CloudflareAccount {
  id: string;
  name: string;
  type: string;
  created_on: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  name_servers: string[];
  status: 'active' | 'pending' | 'initializing' | 'moved' | 'deleted' | 'deactivated';
  paused: boolean;
  type: 'full' | 'partial' | 'sans';
  development_mode: number;
  verification_token?: string;
  owner: { type: string; email: string; id?: string };
  account: { id: string; name: string };
  tenant: { id: string; name: string } | null;
  tenant_unit: { id: string } | null;
  plan: { id: string; name: string; price: number; frequency: string };
  plan_pending: { id: string; name: string; price: number; frequency: string } | null;
  permissions: string[];
  betas: string[];
  stage: string;
  activated_on: string;
  modified_on: string;
  created_on: string;
  core_module_enabled: boolean;
  supports_quote: boolean;
  fallback_origin?: string;
  vault: boolean;
}

export interface CloudflareZoneSettings {
  always_online: { id: string; value: string; editable: boolean; modified_on: string };
  always_use_tls: { id: string; value: string; editable: boolean; modified_on: string };
  automatic_https_rewrites: { id: string; value: string; editable: boolean; modified_on: string };
  brotli: { id: string; value: string; editable: boolean; modified_on: string };
  cache_level: { id: string; value: string; editable: boolean; modified_on: string };
  challenge_ttl: { id: string; value: number; editable: boolean; modified_on: string };
  clearshield: { id: string; value: string; editable: boolean; modified_on: string };
  csrf: { id: string; value: { enabled: boolean; token: string }; editable: boolean; modified_on: string };
  email_obfuscation: { id: string; value: string; editable: boolean; modified_on: string };
  express_network: { id: string; value: string; editable: boolean; modified_on: string };
  filter_log_level: { id: string; value: string; editable: boolean; modified_on: string };
  http3: { id: string; value: string; editable: boolean; modified_on: string };
  ip_geolocation: { id: string; value: string; editable: boolean; modified_on: string };
  ipv6: { id: string; value: string; editable: boolean; modified_on: string };
  logpush: { id: string; value: boolean; editable: boolean; modified_on: string };
  logpush_ownership: { id: string; value: string; editable: boolean; modified_on: string };
  max_upload: { id: string; value: number; editable: boolean; modified_on: string };
  min_tls_version: { id: string; value: string; editable: boolean; modified_on: string };
  minify: { id: string; value: { css: string; html: string; js: string }; editable: boolean; modified_on: string };
  mobile_redirect: { id: string; value: { status: string; mobile_subdomain: string; strip_uri: boolean }; editable: boolean; modified_on: string };
  mtls: { id: string; value: { enabled: boolean; client_cert_ref: string }; editable: boolean; modified_on: string };
  origin_max_http_version: { id: string; value: number; editable: boolean; modified_on: string };
  origin_response_timeout: { id: string; value: number; editable: boolean; modified_on: string };
  polish: { id: string; value: string; editable: boolean; modified_on: string };
  prefetch_preconnect: { id: string; value: boolean; editable: boolean; modified_on: string };
  profile: { id: string; value: string; editable: boolean; modified_on: string };
  proxy_read_timeout: { id: string; value: number; editable: boolean; modified_on: string };
  rr_load_balancing: { id: string; value: boolean; editable: boolean; modified_on: string };
  security_header: { id: string; value: { enabled: boolean; include_subdomains: boolean; preload: boolean; nosniff: boolean;_ct: string; _st: string; pins: string; max_age: number }; editable: boolean; modified_on: string };
  security_level: { id: string; value: string; editable: boolean; modified_on: string };
  server_side_exclude: { id: string; value: string; editable: boolean; modified_on: string };
  source_validation: { id: string; value: string; editable: boolean; modified_on: string };
  ssl: { id: string; value: string; editable: boolean; modified_on: string };
  tls_1_2_only: { id: string; value: string; editable: boolean; modified_on: string };
  tls_1_3: { id: string; value: string; editable: boolean; modified_on: string };
  tls_client_auth: { id: string; value: { enabled: boolean; client_cert_ref: string }; editable: boolean; modified_on: string };
  universal_ssl: { id: string; value: string; editable: boolean; modified_on: string };
  visitors_floor: { id: string; value: number; editable: boolean; modified_on: string };
  warp: { id: string; value: string; editable: boolean; modified_on: string };
  webp: { id: string; value: string; editable: boolean; modified_on: string };
  websockets: { id: string; value: string; editable: boolean; modified_on: string };
}

export interface CloudflareDNSRecord {
  id: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS' | 'SPF' | 'SRV' | 'CAA' | 'CERT' | 'DNSKEY' | 'DS' | 'KEY' | 'LOC' | 'NAPTR' | 'SMIMEA' | 'SSHFP' | 'TLSA' | 'URI';
  name: string;
  content: string;
  proxiable: boolean;
  proxy: boolean;
  ttl: number;
  locked: boolean;
  zone_id: string;
  zone_name: string;
  created_on: string;
  modified_on: string;
  data?: Record<string, unknown>;
  comment?: string;
  tags?: string[];
  matches?: string[];
}

export interface CloudflareDNSRecordSet {
  identifier: string;
  comment?: string;
  content: Array<{ type: string; name: string; content: string; ttl?: number; data?: Record<string, unknown> }>;
  name: string;
  type: string;
  proxied?: boolean;
}

export interface CloudflareWorkerScript {
  id: string;
  etag: string;
  size: number;
  modified_on: string;
  created_on?: string;
  handlers?: string[];
  migration?: { binding?: string; variable?: string; namespace_id?: string };
}

export interface CloudflareWorkerRoute {
  id: string;
  script?: string;
  pattern: string;
  zone_id?: string;
  zone_name?: string;
  enabled: boolean;
}

export interface CloudflareWorkerTail {
  id: string;
  url: string;
  name?: string;
  namespace_id?: string;
}

export interface CloudflareWorkerSecret {
  name: string;
  secret_text?: string;
  type: 'secret_text' | 'secret_file';
  namespace_id?: string;
  secret_id?: string;
}

export interface CloudflareWorkerKVNamespace {
  id: string;
  title: string;
  description: string;
  creation_date: string;
  modification_date: string;
}

export interface CloudflareWorkerKVKey {
  name: string;
  expiration?: number;
  metadata?: Record<string, unknown>;
}

export interface CloudflareWorkerKVValue {
  value: string;
  metadata?: Record<string, unknown>;
  expiration?: number;
}

export interface CloudflareWorkerDurableObjectNamespace {
  id: string;
  name: string;
  description?: string;
  creation_date: string;
}

export interface CloudflareWorkerD1Database {
  id: string;
  name: string;
  description: string;
  created_at: string;
  version: string;
  size_in_bytes: number;
  num_tables: number;
  is_encrypted: boolean;
  account_id: string;
}

export interface CloudflareWorkerR2Bucket {
  name: string;
  creation_date: string;
  location: string;
  custom_domain?: string;
}

export interface CloudflarePagesProject {
  id: string;
  name: string;
  domains: string[];
  source: { type: string; config: { repo_branch?: string; pr_previews_enabled?: boolean } };
  build_config: {
    build_command: string;
    destination_dir: string;
    root_dir?: string;
    node_version?: string;
  };
  production_branch: string;
  aliases: string[];
  created_on: string;
  updated_on: string;
}

export interface CloudflarePagesDeployment {
  id: string;
  project_name: string;
  environment: string;
  url: string;
  status: 'Queued' | 'Building' | 'Deploying' | 'Static' | 'Error' | 'Canceled';
  build: { started_at: string; ended_at?: string; duration?: number };
  deployment_trigger: { type: string; metadata: { branch: string; commit_hash: string } };
  is_soft_deployed: boolean;
  latest_stage?: { name: string; status: string; started_at: string; ended_at?: string };
  created_on: string;
  modified_on: string;
}

export interface CloudflarePageRule {
  id: string;
  status: 'active' | 'disabled';
  priority: number;
  actions: Array<{ id: string; value: unknown }>;
  targets: Array<{ target: string; constraint: { operator: string; value: string } }>;
  created_on: string;
  modified_on: string;
}

export interface CloudflareTransformRule {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  priority: number;
  action: string;
  expression: string;
  action_parameters?: Record<string, unknown>;
  created_on: string;
  modified_on: string;
}

export interface CloudflareOriginRule {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  priority: number;
  action: string;
  expression: string;
  action_parameters?: Record<string, unknown>;
  created_on: string;
  modified_on: string;
}

export interface CloudflareFirewallRule {
  id: string;
  filter: { id: string; expression: string; paused: boolean };
  action: string;
  priority: number | null;
  status: 'active' | 'disabled';
  description: string;
  ref?: string;
  created_on: string;
  modified_on: string;
}

export interface CloudflareFirewallFilter {
  id: string;
  expression: string;
  paused: boolean;
  ref?: string;
  created_on: string;
  modified_on: string;
}

export interface CloudflareFirewallPackage {
  id: string;
  name: string;
  description: string;
  zone_count: number;
  package_id: string;
  count: number;
  modified_on: string;
}

export interface CloudflareFirewallRuleGroup {
  id: string;
  name: string;
  description: string;
  rules_count: number;
  package_id: string;
  mode: string;
  action: string;
}

export interface CloudflareIPList {
  id: string;
  name: string;
  description: string;
  kind: 'ip' | 'asn' | 'country';
  num_items: number;
  num_referenced_rules: number;
  created_on: string;
  modified_on: string;
}

export interface CloudflareIPListItem {
  ip: string;
  comment?: string;
  added_on?: string;
}

export interface CloudflareUserAgentRule {
  id: string;
  ua: string;
  description: string;
  paused: boolean;
  created_on: string;
  modified_on: string;
}

export interface CloudflareRateLimitRule {
  id: string;
  disabled: boolean;
  description: string;
  match: {
    http_version: string;
    method: string;
    scheme: string;
    url: string;
    header?: Record<string, unknown>;
  };
  rate_limit: {
    limit: number;
    period: number;
    period_duration?: number;
    group?: Record<string, unknown>;
    character_match?: Record<string, unknown>;
  };
  action: {
    mode: string;
    timeout?: number;
    status?: number;
    content_type?: string;
    body?: string;
  };
  correlate: { by: string };
  config_id?: string;
  ruleset_id?: string;
  version?: string;
  last_modified?: string;
}

export interface CloudflareCertificate {
  id: string;
  issuer: string;
  signature: string;
  status: string;
  validity_requests: number;
  expires_on: string;
  uploaded_on: string;
  notes: string;
  custom_origin_ca?: { version: number; enabled: boolean };
}

export interface CloudflareSSLCertificate {
  id: string;
  type: 'dedicated' | 'shared' | 'custom' | 'ssl';
  hostname: string;
  certificate_authority: string;
  cert_pem: string;
  chain_pem?: string;
  private_key_pem?: string;
  origin_pull_ca_pem?: string;
  created_at: string;
  expires_at?: string;
  updated_at?: string;
  status?: string;
}

export interface CloudflareCustomCertificate {
  id: string;
  issuer: string;
  signature: string;
  status: string;
  validity_start: string;
  validity_end: string;
  validity_days: number;
  fingerprint: string;
  serial_number: string;
  cert_chain?: Array<{ serial_no: string; expires_on: string; issuer: string; signature: string }>;
}

export interface CloudflareUniversalSSL {
  enabled: boolean;
}

export interface CloudflareLoadBalancer {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  elb_identifier?: string;
  protonly: boolean;
  fallback_pool_id: string;
  default_pool_ids: string[];
  country_pools: Record<string, string[]>;
  region_pools: Record<string, string[]>;
  pop_pools?: Record<string, string[]>;
  ty?: string;
  created_on: string;
  modified_on: string;
}

export interface CloudflareLoadBalancerPool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  monitor: string;
  origins: Array<{
    name: string;
    address: string;
    enabled: boolean;
    weight?: number;
    healthy?: boolean;
    failures?: number;
    disabled_at?: string;
  }>;
  health_check: {
    type: string;
    path: string;
    port: number;
    interval: number;
    timeout: number;
    retries: number;
    method: string;
    header?: Record<string, string>;
  };
  notification_timeout?: number;
  ping_period?: number;
  created_on: string;
  modified_on: string;
}

export interface CloudflareLoadBalancerMonitor {
  id: string;
  name: string;
  description: string;
  type: string;
  method: string;
  path: string;
  port: number;
  timeout: number;
  retries: number;
  interval: number;
  follow_redirects: boolean;
  expected_codes: string;
  probe_zone?: string;
  allow_insecure: boolean;
  created_on: string;
  modified_on: string;
}

export interface CloudflareAccessGroup {
  id: string;
  name: string;
  include: Array<{ email?: { email: string }; email_domain?: { domain: string }; ip?: { ip: string; mask: number } }>;
  exclude: Array<unknown>;
  require: Array<unknown>;
  created_at: string;
  modified_at: string;
}

export interface CloudflareAccessPolicy {
  id: string;
  name: string;
  uid?: string;
  created_at: string;
  updated_at: string;
  enabled: boolean;
  stage: string;
  session_duration: number;
  default_relay_state?: string;
  domain: string;
  type: string;
  include: Array<unknown>;
  exclude: Array<unknown>;
  require: Array<unknown>;
}

export interface CloudflareAccessApplication {
  id: string;
  name: string;
  domain: string;
  type: string;
  session_duration: number;
  uid?: string;
  created_at: string;
  updated_at: string;
  allowed_idps?: string[];
  auto_redirect_to_identity?: boolean;
  enable_binding_cookie?: boolean;
  cors_headers?: { allowed_methods?: string[]; allowed_origins?: { origins: string[] }; allow_credentials?: boolean; max_age?: number };
}

export interface CloudflareAccessServiceToken {
  id: string;
  name: string;
  client_id: string;
  created_at: string;
  expires_at: string;
  last_used_at?: string;
}

export interface CloudflareAccessIdentityProvider {
  id: string;
  name: string;
  type: 'azuread' | 'azure' | 'centrify' | 'github' | 'google' | 'okta' | 'onelogin' | 'salesforce' | 'saml' | 'bitbucket';
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CloudflareWAFRule {
  id: string;
  description: string;
  group?: { id: string; name: string; ruleset: string; ruleset_id: string };
  ref?: string;
  status: 'on' | 'off';
  action: string;
  score_threshold?: number;
  action_parameters?: Record<string, unknown>;
  filter: { expression: string; id: string };
}

export interface CloudflareWAFPackage {
  id: string;
  name: string;
  description: string;
  zone_id: string;
  status: 'active' | 'disabled';
  detection_mode?: 'traditional' | 'anomaly' | 'paranoia';
  action: string;
}

export interface CloudflareAnalyticsZone {
  since: string;
  until: string;
  preview?: boolean;
  data: {
    since: number;
    until: number;
    requests: CloudflareAnalyticsMetric;
    bytes: CloudflareAnalyticsMetric;
    cached_requests: CloudflareAnalyticsMetric;
    cached_bytes: CloudflareAnalyticsMetric;
    uncached_requests: CloudflareAnalyticsMetric;
    uncached_bytes: CloudflareAnalyticsMetric;
    requests_with_untrusted_tls: CloudflareAnalyticsMetric;
    requests_with_valid_tls: CloudflareAnalyticsMetric;
    requests_with_expired_tls: CloudflareAnalyticsMetric;
    requests_with_revoked_tls: CloudflareAnalyticsMetric;
    requests_with_unknown_tls: CloudflareAnalyticsMetric;
    top_requests_by_country: Array<{ country: string; requests: number }>;
    top_requests_by_user_agent: Array<{ ua: string; requests: number }>;
    bandwidth_by_country: Array<{ country: string; bytes: number }>;
    bandwidth_by_content_type: Array<{ content_type: string; bytes: number }>;
    requests_by_content_type: Array<{ content_type: string; requests: number }>;
    requests_by_method: Array<{ method: string; requests: number }>;
    response_status: { '1xx': number; '2xx': number; '3xx': number; '4xx': number; '5xx': number };
    threats: CloudflareAnalyticsMetric;
    content_type_map: Record<string, number>;
  };
}

export interface CloudflareAnalyticsMetric {
  value: number;
  quantile?: { p25: number; p50: number; p75: number; p90: number; p99: number };
  avg?: number;
  max?: number;
  min?: number;
}

export interface CloudflareWorkerAnalytics {
  data: Array<{
    timestamp: number;
    requests: number;
    errors: number;
    cpu_time: number;
    duration: number;
    subrequests: number;
    exceptions: number;
  }>;
  min: number;
  max: number;
}

export interface CloudflareSpectrumApplication {
  id: string;
  dns: { type: string; name: string };
  protocol: string;
  encryption: { mode: string; automatic_https: boolean };
  origin_dns: { type: string; name: string };
  origin_port: number;
  ip_firewall: boolean;
  proxy_protocol: string;
  allowlist?: { ip?: string; ip6?: string };
  argo_smart_routing?: boolean;
  created_on: string;
}

export interface CloudflareMagicFirewallRuleset {
  id: string;
  name: string;
  kind: string;
  description: string;
  version: string;
  rules: Array<{
    id: string;
    version: string;
    action: string;
    direction: string;
    protocol: string;
    source?: Record<string, unknown>;
    destination?: Record<string, unknown>;
  }>;
  created_on: string;
  modified_on: string;
}

export interface CloudflareWaitingRoom {
  id: string;
  name: string;
  description: string;
  host: string;
  path: string;
  queueing_status: 'disabled' | 'active' | 'disabled_temporarily';
  enabled: boolean;
  suspended: boolean;
  json_resp_enabled: boolean;
  new_status_per_minute?: number;
  session_duration: number;
  disable_session_automatic_renewal?: boolean;
  queue_all: boolean;
  cookie_suffix?: string;
  modify_upstream_header?: { enabled: boolean; additional_headers: Record<string, string> };
  custom_page_html?: string;
  created_on: string;
  modified_on: string;
}

export interface CloudflareWaitingRoomEvent {
  id: string;
  name: string;
  description: string;
  waiting_room_id: string;
  action: string;
  start_time: string;
  end_time: string;
  new_max_queue_size?: number;
  new_queue_enabled?: boolean;
  created_on: string;
  modified_on: string;
}

interface CloudflareConfig {
  apiToken: string;
  accountId?: string;
  settings?: CloudflareSettings;
}

export interface CloudflareSettings {
  timeout?: number;
  maxRetries?: number;
}

export class CloudflarePlugin extends IntegrationBase {
  private config: CloudflareConfig;
  private apiBase: string;

  constructor() {
    super('cloudflare', 'Cloudflare', 'Cloudflare integration for Workers, DNS, Zones, Workers KV, Pages, Rules, and Firewall');
    this.config = { apiToken: '' };
    this.apiBase = 'https://api.cloudflare.com/client/v4';
  }

  setConfig(apiToken: string, accountId?: string, settings?: CloudflareSettings): void {
    this.config = { apiToken, accountId, settings };
  }

  setSettings(settings: CloudflareSettings): void {
    this.config.settings = settings;
  }

  private getEndpoint(path: string): string {
    return `${this.apiBase}${path}`;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.getEndpoint(endpoint);
    const response = await fetch(url, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('API token is required');
    }

    this.setConfig(config.accessToken, config.accountId);
    return this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    if (!this.config.apiToken) return false;

    try {
      const result = await this.makeRequest<{ result: { email: string } }>('/user', {
        headers: { Authorization: `Bearer ${this.config.apiToken}` },
      });
      return !!result.result?.email;
    } catch {
      return false;
    }
  }

  async getAccounts(): Promise<{ result: CloudflareAccount[] }> {
    return this.makeRequest<{ result: CloudflareAccount[] }>('/accounts');
  }

  async getAccount(accountId: string): Promise<{ result: CloudflareAccount }> {
    return this.makeRequest<{ result: CloudflareAccount }>(`/accounts/${accountId}`);
  }

  async getZones(options?: { name?: string; status?: string; page?: number; per_page?: number }): Promise<{ result: CloudflareZone[]; result_info: Record<string, unknown> }> {
    const params = new URLSearchParams();
    if (options?.name) params.append('name', options.name);
    if (options?.status) params.append('status', options.status);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.per_page) params.append('per_page', options.per_page.toString());

    return this.makeRequest<{ result: CloudflareZone[]; result_info: Record<string, unknown> }>(`/zones?${params}`);
  }

  async getZone(zoneId: string): Promise<{ result: CloudflareZone }> {
    return this.makeRequest<{ result: CloudflareZone }>(`/zones/${zoneId}`);
  }

  async createZone(zone: { name: string; type?: 'full' | 'partial'; account?: { id: string }; jump_start?: boolean }): Promise<{ result: CloudflareZone }> {
    return this.makeRequest<{ result: CloudflareZone }>('/zones', {
      method: 'POST',
      body: JSON.stringify(zone),
    });
  }

  async deleteZone(zoneId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}`, {
      method: 'DELETE',
    });
  }

  async getZoneSettings(zoneId: string): Promise<{ result: CloudflareZoneSettings }> {
    return this.makeRequest<{ result: CloudflareZoneSettings }>(`/zones/${zoneId}/settings`);
  }

  async updateZoneSettings(zoneId: string, settings: Record<string, unknown>): Promise<{ result: unknown }> {
    return this.makeRequest<{ result: unknown }>(`/zones/${zoneId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  async getDNSRecords(zoneId: string, options?: { type?: string; name?: string; page?: number; per_page?: number }): Promise<{ result: CloudflareDNSRecord[]; result_info: Record<string, unknown> }> {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    if (options?.name) params.append('name', options.name);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.per_page) params.append('per_page', options.per_page.toString());

    return this.makeRequest<{ result: CloudflareDNSRecord[]; result_info: Record<string, unknown> }>(`/zones/${zoneId}/dns_records?${params}`);
  }

  async getDNSRecord(zoneId: string, recordId: string): Promise<{ result: CloudflareDNSRecord }> {
    return this.makeRequest<{ result: CloudflareDNSRecord }>(`/zones/${zoneId}/dns_records/${recordId}`);
  }

  async createDNSRecord(zoneId: string, record: Partial<CloudflareDNSRecord>): Promise<{ result: CloudflareDNSRecord }> {
    return this.makeRequest<{ result: CloudflareDNSRecord }>(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }

  async updateDNSRecord(zoneId: string, recordId: string, record: Partial<CloudflareDNSRecord>): Promise<{ result: CloudflareDNSRecord }> {
    return this.makeRequest<{ result: CloudflareDNSRecord }>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  }

  async deleteDNSRecord(zoneId: string, recordId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
    });
  }

  async importDNSRecords(zoneId: string, body: string): Promise<{ result: { zone_id: string; records_total: number; records_added: number; errors: number } }> {
    return this.makeRequest<{ result: { zone_id: string; records_total: number; records_added: number; errors: number } }>(`/zones/${zoneId}/dns_records/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
    });
  }

  async exportDNSRecords(zoneId: string): Promise<{ result: string }> {
    return this.makeRequest<{ result: string }>(`/zones/${zoneId}/dns_records/export`, {
      method: 'GET',
    });
  }

  async getWorkers(accountId: string): Promise<{ result: CloudflareWorkerScript[] }> {
    return this.makeRequest<{ result: CloudflareWorkerScript[] }>(`/accounts/${accountId}/workers/scripts`);
  }

  async getWorker(accountId: string, scriptName: string): Promise<{ result: CloudflareWorkerScript }> {
    return this.makeRequest<{ result: CloudflareWorkerScript }>(`/accounts/${accountId}/workers/scripts/${scriptName}`);
  }

  async uploadWorker(accountId: string, scriptName: string, script: string, options?: { metadata?: Record<string, unknown> }): Promise<{ result: CloudflareWorkerScript }> {
    const formData = new FormData();
    formData.append('script', new Blob([script], { type: 'text/javascript' }), `${scriptName}.js`);
    if (options?.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    return this.makeRequest<{ result: CloudflareWorkerScript }>(`/accounts/${accountId}/workers/scripts/${scriptName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: formData as unknown as string,
    });
  }

  async deleteWorker(accountId: string, scriptName: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/accounts/${accountId}/workers/scripts/${scriptName}`, {
      method: 'DELETE',
    });
  }

  async getWorkerRoutes(accountId: string, scriptName: string): Promise<{ result: CloudflareWorkerRoute[] }> {
    return this.makeRequest<{ result: CloudflareWorkerRoute[] }>(`/accounts/${accountId}/workers/routes`);
  }

  async createWorkerRoute(accountId: string, route: { pattern: string; script?: string; zone_id?: string }): Promise<{ result: CloudflareWorkerRoute }> {
    return this.makeRequest<{ result: CloudflareWorkerRoute }>(`/accounts/${accountId}/workers/routes`, {
      method: 'POST',
      body: JSON.stringify(route),
    });
  }

  async deleteWorkerRoute(accountId: string, routeId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/accounts/${accountId}/workers/routes/${routeId}`, {
      method: 'DELETE',
    });
  }

  async getWorkerTails(accountId: string, scriptName: string): Promise<{ result: CloudflareWorkerTail[] }> {
    return this.makeRequest<{ result: CloudflareWorkerTail[] }>(`/accounts/${accountId}/workers/scripts/${scriptName}/tails`);
  }

  async createWorkerTail(accountId: string, scriptName: string, url: string): Promise<{ result: CloudflareWorkerTail }> {
    return this.makeRequest<{ result: CloudflareWorkerTail }>(`/accounts/${accountId}/workers/scripts/${scriptName}/tails`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async getWorkerAnalytics(accountId: string, scriptName: string, options?: { start?: number; end?: number }): Promise<CloudflareWorkerAnalytics> {
    const params = new URLSearchParams();
    if (options?.start) params.append('start', options.start.toString());
    if (options?.end) params.append('end', options.end.toString());

    return this.makeRequest<CloudflareWorkerAnalytics>(`/accounts/${accountId}/workers/scripts/${scriptName}/analytics?${params}`);
  }

  async getWorkerSubdomain(accountId: string): Promise<{ result: { subdomain: string } }> {
    return this.makeRequest<{ result: { subdomain: string } }>(`/accounts/${accountId}/workers/subdomain`);
  }

  async setWorkerSubdomain(accountId: string, subdomain: string): Promise<{ result: { subdomain: string } }> {
    return this.makeRequest<{ result: { subdomain: string } }>(`/accounts/${accountId}/workers/subdomain`, {
      method: 'PUT',
      body: JSON.stringify({ subdomain }),
    });
  }

  async getWorkerKVNamespaces(accountId: string): Promise<{ result: CloudflareWorkerKVNamespace[] }> {
    return this.makeRequest<{ result: CloudflareWorkerKVNamespace[] }>(`/accounts/${accountId}/storage/kv/namespaces`);
  }

  async createWorkerKVNamespace(accountId: string, namespace: { title: string; description?: string }): Promise<{ result: CloudflareWorkerKVNamespace }> {
    return this.makeRequest<{ result: CloudflareWorkerKVNamespace }>(`/accounts/${accountId}/storage/kv/namespaces`, {
      method: 'POST',
      body: JSON.stringify(namespace),
    });
  }

  async deleteWorkerKVNamespace(accountId: string, namespaceId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`, {
      method: 'DELETE',
    });
  }

  async getWorkerKVKeys(accountId: string, namespaceId: string, options?: { limit?: number; cursor?: string }): Promise<{ result: CloudflareWorkerKVKey[]; result_info: Record<string, unknown> }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.cursor) params.append('cursor', options.cursor);

    return this.makeRequest<{ result: CloudflareWorkerKVKey[]; result_info: Record<string, unknown> }>(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys?${params}`);
  }

  async getWorkerKVValue(accountId: string, namespaceId: string, keyName: string): Promise<{ result: CloudflareWorkerKVValue }> {
    return this.makeRequest<{ result: CloudflareWorkerKVValue }>(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${keyName}`);
  }

  async writeWorkerKVValue(accountId: string, namespaceId: string, keyName: string, value: CloudflareWorkerKVValue): Promise<{ result: { key: string; value: string } }> {
    return this.makeRequest<{ result: { key: string; value: string } }>(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${keyName}`, {
      method: 'PUT',
      body: JSON.stringify(value),
    });
  }

  async deleteWorkerKVValue(accountId: string, namespaceId: string, keyName: string): Promise<{ result: { key: string } }> {
    return this.makeRequest<{ result: { key: string } }>(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${keyName}`, {
      method: 'DELETE',
    });
  }

  async bulkWriteWorkerKV(accountId: string, namespaceId: string, items: Array<{ key: string; value: string; expiration?: number; metadata?: Record<string, unknown> }>): Promise<{ result: { success: boolean } }> {
    return this.makeRequest<{ result: { success: boolean } }>(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`, {
      method: 'PUT',
      body: JSON.stringify(items),
    });
  }

  async getWorkerDurableObjectNamespaces(accountId: string): Promise<{ result: CloudflareWorkerDurableObjectNamespace[] }> {
    return this.makeRequest<{ result: CloudflareWorkerDurableObjectNamespace[] }>(`/accounts/${accountId}/workers/durable_objects/namespaces`);
  }

  async createWorkerDurableObjectNamespace(accountId: string, namespace: { name: string; description?: string }): Promise<{ result: CloudflareWorkerDurableObjectNamespace }> {
    return this.makeRequest<{ result: CloudflareWorkerDurableObjectNamespace }>(`/accounts/${accountId}/workers/durable_objects/namespaces`, {
      method: 'POST',
      body: JSON.stringify(namespace),
    });
  }

  async getWorkerD1Databases(accountId: string): Promise<{ result: CloudflareWorkerD1Database[] }> {
    return this.makeRequest<{ result: CloudflareWorkerD1Database[] }>(`/accounts/${accountId}/d1/databases`);
  }

  async createWorkerD1Database(accountId: string, database: { name: string; location?: string }): Promise<{ result: CloudflareWorkerD1Database }> {
    return this.makeRequest<{ result: CloudflareWorkerD1Database }>(`/accounts/${accountId}/d1/databases`, {
      method: 'POST',
      body: JSON.stringify(database),
    });
  }

  async deleteWorkerD1Database(accountId: string, databaseId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/accounts/${accountId}/d1/databases/${databaseId}`, {
      method: 'DELETE',
    });
  }

  async queryWorkerD1Database(accountId: string, databaseId: string, query: string, params?: unknown[]): Promise<{ result: { results: unknown[]; meta: Record<string, unknown> } }> {
    return this.makeRequest<{ result: { results: unknown[]; meta: Record<string, unknown> } }>(`/accounts/${accountId}/d1/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({ sql: query, params }),
    });
  }

  async getWorkerR2Buckets(accountId: string): Promise<{ result: CloudflareWorkerR2Bucket[] }> {
    return this.makeRequest<{ result: CloudflareWorkerR2Bucket[] }>(`/accounts/${accountId}/r2/buckets`);
  }

  async createWorkerR2Bucket(accountId: string, bucket: { name: string }): Promise<{ result: CloudflareWorkerR2Bucket }> {
    return this.makeRequest<{ result: CloudflareWorkerR2Bucket }>(`/accounts/${accountId}/r2/buckets`, {
      method: 'POST',
      body: JSON.stringify(bucket),
    });
  }

  async deleteWorkerR2Bucket(accountId: string, bucketName: string): Promise<{ result: { name: string } }> {
    return this.makeRequest<{ result: { name: string } }>(`/accounts/${accountId}/r2/buckets/${bucketName}`, {
      method: 'DELETE',
    });
  }

  async getPagesProjects(accountId: string): Promise<{ result: CloudflarePagesProject[] }> {
    return this.makeRequest<{ result: CloudflarePagesProject[] }>(`/accounts/${accountId}/pages/projects`);
  }

  async getPagesProject(accountId: string, projectName: string): Promise<{ result: CloudflarePagesProject }> {
    return this.makeRequest<{ result: CloudflarePagesProject }>(`/accounts/${accountId}/pages/projects/${projectName}`);
  }

  async createPagesProject(accountId: string, project: { name: string; production_branch: string; build_config?: Record<string, unknown>; source?: Record<string, unknown> }): Promise<{ result: CloudflarePagesProject }> {
    return this.makeRequest<{ result: CloudflarePagesProject }>(`/accounts/${accountId}/pages/projects`, {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async deletePagesProject(accountId: string, projectName: string): Promise<{ result: { name: string } }> {
    return this.makeRequest<{ result: { name: string } }>(`/accounts/${accountId}/pages/projects/${projectName}`, {
      method: 'DELETE',
    });
  }

  async getPagesDeployments(accountId: string, projectName: string): Promise<{ result: CloudflarePagesDeployment[] }> {
    return this.makeRequest<{ result: CloudflarePagesDeployment[] }>(`/accounts/${accountId}/pages/projects/${projectName}/deployments`);
  }

  async getPagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<{ result: CloudflarePagesDeployment }> {
    return this.makeRequest<{ result: CloudflarePagesDeployment }>(`/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}`);
  }

  async createPagesDeployment(accountId: string, projectName: string, branch: string): Promise<{ result: CloudflarePagesDeployment }> {
    return this.makeRequest<{ result: CloudflarePagesDeployment }>(`/accounts/${accountId}/pages/projects/${projectName}/deployments`, {
      method: 'POST',
      body: JSON.stringify({ branch }),
    });
  }

  async rollbackPagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<{ result: CloudflarePagesDeployment }> {
    return this.makeRequest<{ result: CloudflarePagesDeployment }>(`/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}/rollback`, {
      method: 'POST',
    });
  }

  async getPageRules(zoneId: string): Promise<{ result: CloudflarePageRule[] }> {
    return this.makeRequest<{ result: CloudflarePageRule[] }>(`/zones/${zoneId}/pagerules`);
  }

  async createPageRule(zoneId: string, pagerule: Partial<CloudflarePageRule>): Promise<{ result: CloudflarePageRule }> {
    return this.makeRequest<{ result: CloudflarePageRule }>(`/zones/${zoneId}/pagerules`, {
      method: 'POST',
      body: JSON.stringify(pagerule),
    });
  }

  async updatePageRule(zoneId: string, ruleId: string, pagerule: Partial<CloudflarePageRule>): Promise<{ result: CloudflarePageRule }> {
    return this.makeRequest<{ result: CloudflarePageRule }>(`/zones/${zoneId}/pagerules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(pagerule),
    });
  }

  async deletePageRule(zoneId: string, ruleId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/pagerules/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async getTransformRules(zoneId: string): Promise<{ result: CloudflareTransformRule[] }> {
    return this.makeRequest<{ result: CloudflareTransformRule[] }>(`/zones/${zoneId}/rulesets/phases/http_request_transform`);
  }

  async createTransformRule(zoneId: string, rule: Partial<CloudflareTransformRule>): Promise<{ result: CloudflareTransformRule }> {
    return this.makeRequest<{ result: CloudflareTransformRule }>(`/zones/${zoneId}/rulesets/phases/http_request_transform`, {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async updateTransformRule(zoneId: string, ruleId: string, rule: Partial<CloudflareTransformRule>): Promise<{ result: CloudflareTransformRule }> {
    return this.makeRequest<{ result: CloudflareTransformRule }>(`/zones/${zoneId}/rulesets/phases/http_request_transform/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(rule),
    });
  }

  async deleteTransformRule(zoneId: string, ruleId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/rulesets/phases/http_request_transform/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async getOriginRules(zoneId: string): Promise<{ result: CloudflareOriginRule[] }> {
    return this.makeRequest<{ result: CloudflareOriginRule[] }>(`/zones/${zoneId}/rulesets/phases/http_request_origin`);
  }

  async getFirewallRules(zoneId: string): Promise<{ result: CloudflareFirewallRule[] }> {
    return this.makeRequest<{ result: CloudflareFirewallRule[] }>(`/zones/${zoneId}/firewall/rules`);
  }

  async createFirewallRule(zoneId: string, rule: { filter: { expression: string }; action: string; priority?: number; description?: string }): Promise<{ result: CloudflareFirewallRule }> {
    return this.makeRequest<{ result: CloudflareFirewallRule }>(`/zones/${zoneId}/firewall/rules`, {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async updateFirewallRule(zoneId: string, ruleId: string, rule: Partial<CloudflareFirewallRule>): Promise<{ result: CloudflareFirewallRule }> {
    return this.makeRequest<{ result: CloudflareFirewallRule }>(`/zones/${zoneId}/firewall/rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(rule),
    });
  }

  async deleteFirewallRule(zoneId: string, ruleId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/firewall/rules/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async getFirewallFilters(zoneId: string): Promise<{ result: CloudflareFirewallFilter[] }> {
    return this.makeRequest<{ result: CloudflareFirewallFilter[] }>(`/zones/${zoneId}/firewall/filters`);
  }

  async createFirewallFilter(zoneId: string, filter: { expression: string; paused?: boolean }): Promise<{ result: CloudflareFirewallFilter }> {
    return this.makeRequest<{ result: CloudflareFirewallFilter }>(`/zones/${zoneId}/firewall/filters`, {
      method: 'POST',
      body: JSON.stringify(filter),
    });
  }

  async deleteFirewallFilter(zoneId: string, filterId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/firewall/filters/${filterId}`, {
      method: 'DELETE',
    });
  }

  async getFirewallPackages(zoneId: string): Promise<{ result: CloudflareFirewallPackage[] }> {
    return this.makeRequest<{ result: CloudflareFirewallPackage[] }>(`/zones/${zoneId}/firewall/packages`);
  }

  async getFirewallRuleGroups(zoneId: string): Promise<{ result: CloudflareFirewallRuleGroup[] }> {
    return this.makeRequest<{ result: CloudflareFirewallRuleGroup[] }>(`/zones/${zoneId}/firewall/groups`);
  }

  async getIPLists(accountId: string): Promise<{ result: CloudflareIPList[] }> {
    return this.makeRequest<{ result: CloudflareIPList[] }>(`/accounts/${accountId}/firewall/lists`);
  }

  async createIPList(accountId: string, list: { name: string; description: string; kind: 'ip' | 'asn' | 'country' }): Promise<{ result: CloudflareIPList }> {
    return this.makeRequest<{ result: CloudflareIPList }>(`/accounts/${accountId}/firewall/lists`, {
      method: 'POST',
      body: JSON.stringify(list),
    });
  }

  async deleteIPList(accountId: string, listId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/accounts/${accountId}/firewall/lists/${listId}`, {
      method: 'DELETE',
    });
  }

  async getIPListItems(accountId: string, listId: string): Promise<{ result: CloudflareIPListItem[] }> {
    return this.makeRequest<{ result: CloudflareIPListItem[] }>(`/accounts/${accountId}/firewall/lists/${listId}/items`);
  }

  async createIPListItems(accountId: string, listId: string, items: Array<{ ip: string; comment?: string }>): Promise<{ result: { count: number } }> {
    return this.makeRequest<{ result: { count: number } }>(`/accounts/${accountId}/firewall/lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  async deleteIPListItems(accountId: string, listId: string, items: Array<{ ip: string }>): Promise<{ result: { count: number } }> {
    return this.makeRequest<{ result: { count: number } }>(`/accounts/${accountId}/firewall/lists/${listId}/items`, {
      method: 'DELETE',
      body: JSON.stringify(items),
    });
  }

  async getUserAgentRules(zoneId: string): Promise<{ result: CloudflareUserAgentRule[] }> {
    return this.makeRequest<{ result: CloudflareUserAgentRule[] }>(`/zones/${zoneId}/firewall/user_agent_rules`);
  }

  async createUserAgentRule(zoneId: string, rule: { ua: string; description: string; paused?: boolean }): Promise<{ result: CloudflareUserAgentRule }> {
    return this.makeRequest<{ result: CloudflareUserAgentRule }>(`/zones/${zoneId}/firewall/user_agent_rules`, {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async deleteUserAgentRule(zoneId: string, ruleId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/firewall/user_agent_rules/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async getRateLimits(zoneId: string): Promise<{ result: CloudflareRateLimitRule[] }> {
    return this.makeRequest<{ result: CloudflareRateLimitRule[] }>(`/zones/${zoneId}/rate_limits`);
  }

  async createRateLimit(zoneId: string, limit: Partial<CloudflareRateLimitRule>): Promise<{ result: CloudflareRateLimitRule }> {
    return this.makeRequest<{ result: CloudflareRateLimitRule }>(`/zones/${zoneId}/rate_limits`, {
      method: 'POST',
      body: JSON.stringify(limit),
    });
  }

  async updateRateLimit(zoneId: string, limitId: string, limit: Partial<CloudflareRateLimitRule>): Promise<{ result: CloudflareRateLimitRule }> {
    return this.makeRequest<{ result: CloudflareRateLimitRule }>(`/zones/${zoneId}/rate_limits/${limitId}`, {
      method: 'PUT',
      body: JSON.stringify(limit),
    });
  }

  async deleteRateLimit(zoneId: string, limitId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/rate_limits/${limitId}`, {
      method: 'DELETE',
    });
  }

  async getCustomCertificates(zoneId: string): Promise<{ result: CloudflareCustomCertificate[] }> {
    return this.makeRequest<{ result: CloudflareCustomCertificate[] }>(`/zones/${zoneId}/custom_certificates`);
  }

  async uploadCustomCertificate(zoneId: string, cert: { certificate: string; private_key: string; bundle_method?: string }): Promise<{ result: CloudflareCustomCertificate }> {
    return this.makeRequest<{ result: CloudflareCustomCertificate }>(`/zones/${zoneId}/custom_certificates`, {
      method: 'POST',
      body: JSON.stringify(cert),
    });
  }

  async deleteCustomCertificate(zoneId: string, certId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/custom_certificates/${certId}`, {
      method: 'DELETE',
    });
  }

  async getSSLCertificates(zoneId: string): Promise<{ result: CloudflareSSLCertificate[] }> {
    return this.makeRequest<{ result: CloudflareSSLCertificate[] }>(`/zones/${zoneId}/ssl/certificates`);
  }

  async getUniversalSSL(zoneId: string): Promise<{ result: CloudflareUniversalSSL }> {
    return this.makeRequest<{ result: CloudflareUniversalSSL }>(`/zones/${zoneId}/ssl/universal`);
  }

  async enableUniversalSSL(zoneId: string): Promise<{ result: { enabled: boolean } }> {
    return this.makeRequest<{ result: { enabled: boolean } }>(`/zones/${zoneId}/ssl/universal`, {
      method: 'POST',
    });
  }

  async getLoadBalancers(zoneId: string): Promise<{ result: CloudflareLoadBalancer[] }> {
    return this.makeRequest<{ result: CloudflareLoadBalancer[] }>(`/zones/${zoneId}/load_balancers`);
  }

  async getLoadBalancer(zoneId: string, lbId: string): Promise<{ result: CloudflareLoadBalancer }> {
    return this.makeRequest<{ result: CloudflareLoadBalancer }>(`/zones/${zoneId}/load_balancers/${lbId}`);
  }

  async createLoadBalancer(zoneId: string, lb: Partial<CloudflareLoadBalancer>): Promise<{ result: CloudflareLoadBalancer }> {
    return this.makeRequest<{ result: CloudflareLoadBalancer }>(`/zones/${zoneId}/load_balancers`, {
      method: 'POST',
      body: JSON.stringify(lb),
    });
  }

  async updateLoadBalancer(zoneId: string, lbId: string, lb: Partial<CloudflareLoadBalancer>): Promise<{ result: CloudflareLoadBalancer }> {
    return this.makeRequest<{ result: CloudflareLoadBalancer }>(`/zones/${zoneId}/load_balancers/${lbId}`, {
      method: 'PUT',
      body: JSON.stringify(lb),
    });
  }

  async deleteLoadBalancer(zoneId: string, lbId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/load_balancers/${lbId}`, {
      method: 'DELETE',
    });
  }

  async getLoadBalancerPools(zoneId: string): Promise<{ result: CloudflareLoadBalancerPool[] }> {
    return this.makeRequest<{ result: CloudflareLoadBalancerPool[] }>(`/zones/${zoneId}/load_balancers/pools`);
  }

  async createLoadBalancerPool(zoneId: string, pool: Partial<CloudflareLoadBalancerPool>): Promise<{ result: CloudflareLoadBalancerPool }> {
    return this.makeRequest<{ result: CloudflareLoadBalancerPool }>(`/zones/${zoneId}/load_balancers/pools`, {
      method: 'POST',
      body: JSON.stringify(pool),
    });
  }

  async updateLoadBalancerPool(zoneId: string, poolId: string, pool: Partial<CloudflareLoadBalancerPool>): Promise<{ result: CloudflareLoadBalancerPool }> {
    return this.makeRequest<{ result: CloudflareLoadBalancerPool }>(`/zones/${zoneId}/load_balancers/pools/${poolId}`, {
      method: 'PUT',
      body: JSON.stringify(pool),
    });
  }

  async deleteLoadBalancerPool(zoneId: string, poolId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/load_balancers/pools/${poolId}`, {
      method: 'DELETE',
    });
  }

  async getLoadBalancerMonitors(zoneId: string): Promise<{ result: CloudflareLoadBalancerMonitor[] }> {
    return this.makeRequest<{ result: CloudflareLoadBalancerMonitor[] }>(`/zones/${zoneId}/load_balancers/monitors`);
  }

  async createLoadBalancerMonitor(zoneId: string, monitor: Partial<CloudflareLoadBalancerMonitor>): Promise<{ result: CloudflareLoadBalancerMonitor }> {
    return this.makeRequest<{ result: CloudflareLoadBalancerMonitor }>(`/zones/${zoneId}/load_balancers/monitors`, {
      method: 'POST',
      body: JSON.stringify(monitor),
    });
  }

  async updateLoadBalancerMonitor(zoneId: string, monitorId: string, monitor: Partial<CloudflareLoadBalancerMonitor>): Promise<{ result: CloudflareLoadBalancerMonitor }> {
    return this.makeRequest<{ result: CloudflareLoadBalancerMonitor }>(`/zones/${zoneId}/load_balancers/monitors/${monitorId}`, {
      method: 'PUT',
      body: JSON.stringify(monitor),
    });
  }

  async deleteLoadBalancerMonitor(zoneId: string, monitorId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/load_balancers/monitors/${monitorId}`, {
      method: 'DELETE',
    });
  }

  async getAccessGroups(accountId: string): Promise<{ result: CloudflareAccessGroup[] }> {
    return this.makeRequest<{ result: CloudflareAccessGroup[] }>(`/accounts/${accountId}/access/groups`);
  }

  async createAccessGroup(accountId: string, group: { name: string; include?: Array<unknown>; exclude?: Array<unknown>; require?: Array<unknown> }): Promise<{ result: CloudflareAccessGroup }> {
    return this.makeRequest<{ result: CloudflareAccessGroup }>(`/accounts/${accountId}/access/groups`, {
      method: 'POST',
      body: JSON.stringify(group),
    });
  }

  async updateAccessGroup(accountId: string, groupId: string, group: Partial<CloudflareAccessGroup>): Promise<{ result: CloudflareAccessGroup }> {
    return this.makeRequest<{ result: CloudflareAccessGroup }>(`/accounts/${accountId}/access/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(group),
    });
  }

  async deleteAccessGroup(accountId: string, groupId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/accounts/${accountId}/access/groups/${groupId}`, {
      method: 'DELETE',
    });
  }

  async getAccessPolicies(accountId: string, applicationId: string): Promise<{ result: CloudflareAccessPolicy[] }> {
    return this.makeRequest<{ result: CloudflareAccessPolicy[] }>(`/accounts/${accountId}/access/policies`);
  }

  async createAccessPolicy(accountId: string, applicationId: string, policy: Partial<CloudflareAccessPolicy>): Promise<{ result: CloudflareAccessPolicy }> {
    return this.makeRequest<{ result: CloudflareAccessPolicy }>(`/accounts/${accountId}/access/policies`, {
      method: 'POST',
      body: JSON.stringify(policy),
    });
  }

  async updateAccessPolicy(accountId: string, applicationId: string, policyId: string, policy: Partial<CloudflareAccessPolicy>): Promise<{ result: CloudflareAccessPolicy }> {
    return this.makeRequest<{ result: CloudflareAccessPolicy }>(`/accounts/${accountId}/access/policies/${policyId}`, {
      method: 'PUT',
      body: JSON.stringify(policy),
    });
  }

  async deleteAccessPolicy(accountId: string, applicationId: string, policyId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/accounts/${accountId}/access/policies/${policyId}`, {
      method: 'DELETE',
    });
  }

  async getAccessApplications(accountId: string): Promise<{ result: CloudflareAccessApplication[] }> {
    return this.makeRequest<{ result: CloudflareAccessApplication[] }>(`/accounts/${accountId}/access/apps`);
  }

  async createAccessApplication(accountId: string, app: { name: string; domain: string; type: string; session_duration?: number }): Promise<{ result: CloudflareAccessApplication }> {
    return this.makeRequest<{ result: CloudflareAccessApplication }>(`/accounts/${accountId}/access/apps`, {
      method: 'POST',
      body: JSON.stringify(app),
    });
  }

  async updateAccessApplication(accountId: string, appId: string, app: Partial<CloudflareAccessApplication>): Promise<{ result: CloudflareAccessApplication }> {
    return this.makeRequest<{ result: CloudflareAccessApplication }>(`/accounts/${accountId}/access/apps/${appId}`, {
      method: 'PUT',
      body: JSON.stringify(app),
    });
  }

  async deleteAccessApplication(accountId: string, appId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/accounts/${accountId}/access/apps/${appId}`, {
      method: 'DELETE',
    });
  }

  async getAccessServiceTokens(accountId: string): Promise<{ result: CloudflareAccessServiceToken[] }> {
    return this.makeRequest<{ result: CloudflareAccessServiceToken[] }>(`/accounts/${accountId}/access/service_tokens`);
  }

  async createAccessServiceToken(accountId: string, token: { name: string }): Promise<{ result: CloudflareAccessServiceToken }> {
    return this.makeRequest<{ result: CloudflareAccessServiceToken }>(`/accounts/${accountId}/access/service_tokens`, {
      method: 'POST',
      body: JSON.stringify(token),
    });
  }

  async deleteAccessServiceToken(accountId: string, tokenId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/accounts/${accountId}/access/service_tokens/${tokenId}`, {
      method: 'DELETE',
    });
  }

  async getAccessIdentityProviders(accountId: string): Promise<{ result: CloudflareAccessIdentityProvider[] }> {
    return this.makeRequest<{ result: CloudflareAccessIdentityProvider[] }>(`/accounts/${accountId}/access/identity_providers`);
  }

  async createAccessIdentityProvider(accountId: string, idp: { name: string; type: string; config: Record<string, unknown> }): Promise<{ result: CloudflareAccessIdentityProvider }> {
    return this.makeRequest<{ result: CloudflareAccessIdentityProvider }>(`/accounts/${accountId}/access/identity_providers`, {
      method: 'POST',
      body: JSON.stringify(idp),
    });
  }

  async updateAccessIdentityProvider(accountId: string, idpId: string, idp: Partial<CloudflareAccessIdentityProvider>): Promise<{ result: CloudflareAccessIdentityProvider }> {
    return this.makeRequest<{ result: CloudflareAccessIdentityProvider }>(`/accounts/${accountId}/access/identity_providers/${idpId}`, {
      method: 'PUT',
      body: JSON.stringify(idp),
    });
  }

  async deleteAccessIdentityProvider(accountId: string, idpId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/accounts/${accountId}/access/identity_providers/${idpId}`, {
      method: 'DELETE',
    });
  }

  async getWAFPackages(zoneId: string): Promise<{ result: CloudflareWAFPackage[] }> {
    return this.makeRequest<{ result: CloudflareWAFPackage[] }>(`/zones/${zoneId}/firewall/waf/packages`);
  }

  async getWAFRules(zoneId: string, packageId: string): Promise<{ result: CloudflareWAFRule[] }> {
    return this.makeRequest<{ result: CloudflareWAFRule[] }>(`/zones/${zoneId}/firewall/waf/packages/${packageId}/rules`);
  }

  async updateWAFRule(zoneId: string, packageId: string, ruleId: string, rule: { status?: string; action?: string }): Promise<{ result: CloudflareWAFRule }> {
    return this.makeRequest<{ result: CloudflareWAFRule }>(`/zones/${zoneId}/firewall/waf/packages/${packageId}/rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify(rule),
    });
  }

  async getZoneAnalytics(zoneId: string, options?: { since?: number; until?: number }): Promise<CloudflareAnalyticsZone> {
    const params = new URLSearchParams();
    if (options?.since) params.append('since', options.since.toString());
    if (options?.until) params.append('until', options.until.toString());

    return this.makeRequest<CloudflareAnalyticsZone>(`/zones/${zoneId}/analytics/dashboard?${params}`);
  }

  async purgeCache(zoneId: string, options?: { files?: string[]; tags?: string[]; hosts?: string[] }): Promise<{ result: { id: string } }> {
    const body: Record<string, unknown> = {};
    if (options?.files) body.files = options.files;
    if (options?.tags) body.tags = options.tags;
    if (options?.hosts) body.hosts = options.hosts;

    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getWaitingRooms(zoneId: string): Promise<{ result: CloudflareWaitingRoom[] }> {
    return this.makeRequest<{ result: CloudflareWaitingRoom[] }>(`/zones/${zoneId}/waiting_rooms`);
  }

  async createWaitingRoom(zoneId: string, room: Partial<CloudflareWaitingRoom>): Promise<{ result: CloudflareWaitingRoom }> {
    return this.makeRequest<{ result: CloudflareWaitingRoom }>(`/zones/${zoneId}/waiting_rooms`, {
      method: 'POST',
      body: JSON.stringify(room),
    });
  }

  async updateWaitingRoom(zoneId: string, roomId: string, room: Partial<CloudflareWaitingRoom>): Promise<{ result: CloudflareWaitingRoom }> {
    return this.makeRequest<{ result: CloudflareWaitingRoom }>(`/zones/${zoneId}/waiting_rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(room),
    });
  }

  async deleteWaitingRoom(zoneId: string, roomId: string): Promise<{ result: { id: string } }> {
    return this.makeRequest<{ result: { id: string } }>(`/zones/${zoneId}/waiting_rooms/${roomId}`, {
      method: 'DELETE',
    });
  }

  async getWaitingRoomEvents(zoneId: string, roomId: string): Promise<{ result: CloudflareWaitingRoomEvent[] }> {
    return this.makeRequest<{ result: CloudflareWaitingRoomEvent[] }>(`/zones/${zoneId}/waiting_rooms/${roomId}/events`);
  }

  async createWaitingRoomEvent(zoneId: string, roomId: string, event: Partial<CloudflareWaitingRoomEvent>): Promise<{ result: CloudflareWaitingRoomEvent }> {
    return this.makeRequest<{ result: CloudflareWaitingRoomEvent }>(`/zones/${zoneId}/waiting_rooms/${roomId}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async getCloudflareIPs(): Promise<{ ipv4: string[]; ipv6: string[] }> {
    return this.makeRequest<{ ipv4: string[]; ipv6: string[] }>('/ips');
  }

  async cleanup(): Promise<void> {
    this.config = { apiToken: '' };
  }

  getManifest(): PluginManifest {
    return {
      id: 'cloudflare',
      name: 'Cloudflare',
      version: '2.0.0',
      description: 'Cloudflare integration for Workers, DNS, Zones, Workers KV, Pages, Rules, and Firewall',
      author: 'TIMPS Team',
      main: 'cloudflare-new.js',
      keywords: ['cloudflare', 'workers', 'kv', 'dns', 'cdn', 'pages', 'firewall', 'serverless', 'd1', 'r2'],
      actions: [
        { id: 'get_accounts', name: 'Get Accounts', description: 'List all accounts' },
        { id: 'get_account', name: 'Get Account', description: 'Get account details' },
        { id: 'get_zones', name: 'Get Zones', description: 'List all zones' },
        { id: 'get_zone', name: 'Get Zone', description: 'Get zone details' },
        { id: 'create_zone', name: 'Create Zone', description: 'Create a new zone' },
        { id: 'delete_zone', name: 'Delete Zone', description: 'Delete a zone' },
        { id: 'get_zone_settings', name: 'Get Zone Settings', description: 'Get zone settings' },
        { id: 'update_zone_settings', name: 'Update Zone Settings', description: 'Update zone settings' },
        { id: 'get_dns_records', name: 'Get DNS Records', description: 'List DNS records' },
        { id: 'get_dns_record', name: 'Get DNS Record', description: 'Get specific DNS record' },
        { id: 'create_dns_record', name: 'Create DNS Record', description: 'Add a DNS record' },
        { id: 'update_dns_record', name: 'Update DNS Record', description: 'Update a DNS record' },
        { id: 'delete_dns_record', name: 'Delete DNS Record', description: 'Remove a DNS record' },
        { id: 'import_dns_records', name: 'Import DNS Records', description: 'Import DNS records' },
        { id: 'export_dns_records', name: 'Export DNS Records', description: 'Export DNS records' },
        { id: 'get_workers', name: 'Get Workers', description: 'List all workers' },
        { id: 'get_worker', name: 'Get Worker', description: 'Get worker script' },
        { id: 'upload_worker', name: 'Upload Worker', description: 'Upload worker script' },
        { id: 'delete_worker', name: 'Delete Worker', description: 'Delete worker script' },
        { id: 'get_worker_routes', name: 'Get Worker Routes', description: 'List worker routes' },
        { id: 'create_worker_route', name: 'Create Worker Route', description: 'Add a worker route' },
        { id: 'delete_worker_route', name: 'Delete Worker Route', description: 'Remove a worker route' },
        { id: 'get_worker_kv_namespaces', name: 'Get KV Namespaces', description: 'List KV namespaces' },
        { id: 'create_kv_namespace', name: 'Create KV Namespace', description: 'Create a KV namespace' },
        { id: 'delete_kv_namespace', name: 'Delete KV Namespace', description: 'Delete a KV namespace' },
        { id: 'get_kv_keys', name: 'Get KV Keys', description: 'List KV keys' },
        { id: 'get_kv_value', name: 'Get KV Value', description: 'Get KV value' },
        { id: 'write_kv_value', name: 'Write KV Value', description: 'Write KV value' },
        { id: 'delete_kv_value', name: 'Delete KV Value', description: 'Delete KV value' },
        { id: 'bulk_write_kv', name: 'Bulk Write KV', description: 'Bulk write KV values' },
        { id: 'get_d1_databases', name: 'Get D1 Databases', description: 'List D1 databases' },
        { id: 'create_d1_database', name: 'Create D1 Database', description: 'Create D1 database' },
        { id: 'delete_d1_database', name: 'Delete D1 Database', description: 'Delete D1 database' },
        { id: 'query_d1_database', name: 'Query D1 Database', description: 'Run SQL query' },
        { id: 'get_r2_buckets', name: 'Get R2 Buckets', description: 'List R2 buckets' },
        { id: 'create_r2_bucket', name: 'Create R2 Bucket', description: 'Create R2 bucket' },
        { id: 'delete_r2_bucket', name: 'Delete R2 Bucket', description: 'Delete R2 bucket' },
        { id: 'get_pages_projects', name: 'Get Pages Projects', description: 'List Pages projects' },
        { id: 'get_pages_project', name: 'Get Pages Project', description: 'Get Pages project' },
        { id: 'create_pages_project', name: 'Create Pages Project', description: 'Create Pages project' },
        { id: 'delete_pages_project', name: 'Delete Pages Project', description: 'Delete Pages project' },
        { id: 'get_pages_deployments', name: 'Get Pages Deployments', description: 'List Pages deployments' },
        { id: 'create_pages_deployment', name: 'Create Pages Deployment', description: 'Create deployment' },
        { id: 'rollback_pages_deployment', name: 'Rollback Deployment', description: 'Rollback deployment' },
        { id: 'get_page_rules', name: 'Get Page Rules', description: 'List page rules' },
        { id: 'create_page_rule', name: 'Create Page Rule', description: 'Create page rule' },
        { id: 'update_page_rule', name: 'Update Page Rule', description: 'Update page rule' },
        { id: 'delete_page_rule', name: 'Delete Page Rule', description: 'Delete page rule' },
        { id: 'get_transform_rules', name: 'Get Transform Rules', description: 'List transform rules' },
        { id: 'create_transform_rule', name: 'Create Transform Rule', description: 'Create transform rule' },
        { id: 'get_firewall_rules', name: 'Get Firewall Rules', description: 'List firewall rules' },
        { id: 'create_firewall_rule', name: 'Create Firewall Rule', description: 'Create firewall rule' },
        { id: 'update_firewall_rule', name: 'Update Firewall Rule', description: 'Update firewall rule' },
        { id: 'delete_firewall_rule', name: 'Delete Firewall Rule', description: 'Delete firewall rule' },
        { id: 'get_firewall_filters', name: 'Get Firewall Filters', description: 'List firewall filters' },
        { id: 'create_firewall_filter', name: 'Create Firewall Filter', description: 'Create firewall filter' },
        { id: 'get_ip_lists', name: 'Get IP Lists', description: 'List IP lists' },
        { id: 'create_ip_list', name: 'Create IP List', description: 'Create IP list' },
        { id: 'delete_ip_list', name: 'Delete IP List', description: 'Delete IP list' },
        { id: 'get_ip_list_items', name: 'Get IP List Items', description: 'List IP list items' },
        { id: 'create_ip_list_items', name: 'Add IP List Items', description: 'Add items to IP list' },
        { id: 'delete_ip_list_items', name: 'Remove IP List Items', description: 'Remove items from IP list' },
        { id: 'get_user_agent_rules', name: 'Get User Agent Rules', description: 'List user agent rules' },
        { id: 'create_user_agent_rule', name: 'Create User Agent Rule', description: 'Create user agent rule' },
        { id: 'delete_user_agent_rule', name: 'Delete User Agent Rule', description: 'Delete user agent rule' },
        { id: 'get_rate_limits', name: 'Get Rate Limits', description: 'List rate limits' },
        { id: 'create_rate_limit', name: 'Create Rate Limit', description: 'Create rate limit' },
        { id: 'update_rate_limit', name: 'Update Rate Limit', description: 'Update rate limit' },
        { id: 'delete_rate_limit', name: 'Delete Rate Limit', description: 'Delete rate limit' },
        { id: 'get_custom_certificates', name: 'Get Custom Certificates', description: 'List custom certificates' },
        { id: 'upload_custom_certificate', name: 'Upload Custom Certificate', description: 'Upload certificate' },
        { id: 'delete_custom_certificate', name: 'Delete Custom Certificate', description: 'Delete certificate' },
        { id: 'get_ssl_certificates', name: 'Get SSL Certificates', description: 'List SSL certificates' },
        { id: 'get_load_balancers', name: 'Get Load Balancers', description: 'List load balancers' },
        { id: 'create_load_balancer', name: 'Create Load Balancer', description: 'Create load balancer' },
        { id: 'update_load_balancer', name: 'Update Load Balancer', description: 'Update load balancer' },
        { id: 'delete_load_balancer', name: 'Delete Load Balancer', description: 'Delete load balancer' },
        { id: 'get_lb_pools', name: 'Get LB Pools', description: 'List load balancer pools' },
        { id: 'create_lb_pool', name: 'Create LB Pool', description: 'Create LB pool' },
        { id: 'update_lb_pool', name: 'Update LB Pool', description: 'Update LB pool' },
        { id: 'delete_lb_pool', name: 'Delete LB Pool', description: 'Delete LB pool' },
        { id: 'get_lb_monitors', name: 'Get LB Monitors', description: 'List LB monitors' },
        { id: 'create_lb_monitor', name: 'Create LB Monitor', description: 'Create LB monitor' },
        { id: 'update_lb_monitor', name: 'Update LB Monitor', description: 'Update LB monitor' },
        { id: 'delete_lb_monitor', name: 'Delete LB Monitor', description: 'Delete LB monitor' },
        { id: 'get_access_groups', name: 'Get Access Groups', description: 'List Access groups' },
        { id: 'create_access_group', name: 'Create Access Group', description: 'Create Access group' },
        { id: 'update_access_group', name: 'Update Access Group', description: 'Update Access group' },
        { id: 'delete_access_group', name: 'Delete Access Group', description: 'Delete Access group' },
        { id: 'get_access_apps', name: 'Get Access Applications', description: 'List Access applications' },
        { id: 'create_access_app', name: 'Create Access Application', description: 'Create Access application' },
        { id: 'update_access_app', name: 'Update Access Application', description: 'Update Access application' },
        { id: 'delete_access_app', name: 'Delete Access Application', description: 'Delete Access application' },
        { id: 'get_access_service_tokens', name: 'Get Service Tokens', description: 'List service tokens' },
        { id: 'create_service_token', name: 'Create Service Token', description: 'Create service token' },
        { id: 'delete_service_token', name: 'Delete Service Token', description: 'Delete service token' },
        { id: 'get_access_idps', name: 'Get Identity Providers', description: 'List identity providers' },
        { id: 'create_idp', name: 'Create Identity Provider', description: 'Create identity provider' },
        { id: 'update_idp', name: 'Update Identity Provider', description: 'Update identity provider' },
        { id: 'delete_idp', name: 'Delete Identity Provider', description: 'Delete identity provider' },
        { id: 'get_waf_packages', name: 'Get WAF Packages', description: 'List WAF packages' },
        { id: 'get_waf_rules', name: 'Get WAF Rules', description: 'List WAF rules' },
        { id: 'update_waf_rule', name: 'Update WAF Rule', description: 'Update WAF rule' },
        { id: 'get_zone_analytics', name: 'Get Zone Analytics', description: 'Get analytics data' },
        { id: 'purge_cache', name: 'Purge Cache', description: 'Purge cache' },
        { id: 'get_waiting_rooms', name: 'Get Waiting Rooms', description: 'List waiting rooms' },
        { id: 'create_waiting_room', name: 'Create Waiting Room', description: 'Create waiting room' },
        { id: 'update_waiting_room', name: 'Update Waiting Room', description: 'Update waiting room' },
        { id: 'delete_waiting_room', name: 'Delete Waiting Room', description: 'Delete waiting room' },
        { id: 'get_cloudflare_ips', name: 'Get Cloudflare IPs', description: 'List Cloudflare IPs' },
        { id: 'test_connection', name: 'Test Connection', description: 'Test Cloudflare connection' },
      ],
      triggers: [
        { id: 'zone_created', name: 'Zone Created', description: 'Triggered when a zone is created' },
        { id: 'zone_deleted', name: 'Zone Deleted', description: 'Triggered when a zone is deleted' },
        { id: 'dns_record_created', name: 'DNS Record Created', description: 'Triggered when DNS record is added' },
        { id: 'dns_record_deleted', name: 'DNS Record Deleted', description: 'Triggered when DNS record is removed' },
        { id: 'worker_uploaded', name: 'Worker Uploaded', description: 'Triggered when worker is uploaded' },
        { id: 'worker_deleted', name: 'Worker Deleted', description: 'Triggered when worker is deleted' },
        { id: 'firewall_rule_created', name: 'Firewall Rule Created', description: 'Triggered when firewall rule is added' },
        { id: 'firewall_rule_deleted', name: 'Firewall Rule Deleted', description: 'Triggered when firewall rule is removed' },
      ],
      auth: {
        type: 'bearer',
        fields: [
          { name: 'accessToken', label: 'API Token', description: 'Your Cloudflare API token', required: true },
          { name: 'accountId', label: 'Account ID', description: 'Optional account ID for account-scoped resources', required: false },
        ],
      },
      settings: [
        { name: 'timeout', label: 'Request Timeout', type: 'number', default: 30000 },
        { name: 'maxRetries', label: 'Max Retries', type: 'number', default: 3 },
      ],
      connectionTest: { endpoint: '/user', method: 'GET' },
    };
  }

  executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    switch (action) {
      case 'get_accounts':
        return this.getAccounts();
      case 'get_account':
        return this.getAccount(params.accountId as string);
      case 'get_zones':
        return this.getZones(params as any);
      case 'get_zone':
        return this.getZone(params.zoneId as string);
      case 'create_zone':
        return this.createZone(params as any);
      case 'delete_zone':
        return this.deleteZone(params.zoneId as string);
      case 'get_zone_settings':
        return this.getZoneSettings(params.zoneId as string);
      case 'update_zone_settings':
        return this.updateZoneSettings(params.zoneId as string, params.updates as Record<string, unknown>);
      case 'get_dns_records':
        return this.getDNSRecords(params.zoneId as string, params as any);
      case 'get_dns_record':
        return this.getDNSRecord(params.zoneId as string, params.recordId as string);
      case 'create_dns_record':
        return this.createDNSRecord(params.zoneId as string, params.record as any);
      case 'update_dns_record':
        return this.updateDNSRecord(params.zoneId as string, params.recordId as string, params.record as any);
      case 'delete_dns_record':
        return this.deleteDNSRecord(params.zoneId as string, params.recordId as string);
      case 'import_dns_records':
        return this.importDNSRecords(params.zoneId as string, params.body as string);
      case 'export_dns_records':
        return this.exportDNSRecords(params.zoneId as string);
      case 'get_workers':
        return this.getWorkers(params.accountId as string);
      case 'get_worker':
        return this.getWorker(params.accountId as string, params.scriptName as string);
      case 'upload_worker':
        return this.uploadWorker(params.accountId as string, params.scriptName as string, params.script as string, params as any);
      case 'delete_worker':
        return this.deleteWorker(params.accountId as string, params.scriptName as string);
      case 'get_worker_routes':
        return this.getWorkerRoutes(params.accountId as string, params.scriptName as string);
      case 'create_worker_route':
        return this.createWorkerRoute(params.accountId as string, params as any);
      case 'delete_worker_route':
        return this.deleteWorkerRoute(params.accountId as string, params.routeId as string);
      case 'get_worker_kv_namespaces':
        return this.getWorkerKVNamespaces(params.accountId as string);
      case 'create_kv_namespace':
        return this.createWorkerKVNamespace(params.accountId as string, params as any);
      case 'delete_kv_namespace':
        return this.deleteWorkerKVNamespace(params.accountId as string, params.namespaceId as string);
      case 'get_kv_keys':
        return this.getWorkerKVKeys(params.accountId as string, params.namespaceId as string, params as any);
      case 'get_kv_value':
        return this.getWorkerKVValue(params.accountId as string, params.namespaceId as string, params.keyName as string);
      case 'write_kv_value':
        return this.writeWorkerKVValue(params.accountId as string, params.namespaceId as string, params.keyName as string, params as any);
      case 'delete_kv_value':
        return this.deleteWorkerKVValue(params.accountId as string, params.namespaceId as string, params.keyName as string);
      case 'bulk_write_kv':
        return this.bulkWriteWorkerKV(params.accountId as string, params.namespaceId as string, params.items as any[]);
      case 'get_d1_databases':
        return this.getWorkerD1Databases(params.accountId as string);
      case 'create_d1_database':
        return this.createWorkerD1Database(params.accountId as string, params as any);
      case 'delete_d1_database':
        return this.deleteWorkerD1Database(params.accountId as string, params.databaseId as string);
      case 'query_d1_database':
        return this.queryWorkerD1Database(params.accountId as string, params.databaseId as string, params.query as string, params.params as any[]);
      case 'get_r2_buckets':
        return this.getWorkerR2Buckets(params.accountId as string);
      case 'create_r2_bucket':
        return this.createWorkerR2Bucket(params.accountId as string, params as any);
      case 'delete_r2_bucket':
        return this.deleteWorkerR2Bucket(params.accountId as string, params.bucketName as string);
      case 'get_pages_projects':
        return this.getPagesProjects(params.accountId as string);
      case 'get_pages_project':
        return this.getPagesProject(params.accountId as string, params.projectName as string);
      case 'create_pages_project':
        return this.createPagesProject(params.accountId as string, params as any);
      case 'delete_pages_project':
        return this.deletePagesProject(params.accountId as string, params.projectName as string);
      case 'get_pages_deployments':
        return this.getPagesDeployments(params.accountId as string, params.projectName as string);
      case 'get_pages_deployment':
        return this.getPagesDeployment(params.accountId as string, params.projectName as string, params.deploymentId as string);
      case 'create_pages_deployment':
        return this.createPagesDeployment(params.accountId as string, params.projectName as string, params.branch as string);
      case 'rollback_pages_deployment':
        return this.rollbackPagesDeployment(params.accountId as string, params.projectName as string, params.deploymentId as string);
      case 'get_page_rules':
        return this.getPageRules(params.zoneId as string);
      case 'create_page_rule':
        return this.createPageRule(params.zoneId as string, params as any);
      case 'update_page_rule':
        return this.updatePageRule(params.zoneId as string, params.ruleId as string, params as any);
      case 'delete_page_rule':
        return this.deletePageRule(params.zoneId as string, params.ruleId as string);
      case 'get_transform_rules':
        return this.getTransformRules(params.zoneId as string);
      case 'create_transform_rule':
        return this.createTransformRule(params.zoneId as string, params as any);
      case 'get_firewall_rules':
        return this.getFirewallRules(params.zoneId as string);
      case 'create_firewall_rule':
        return this.createFirewallRule(params.zoneId as string, params as any);
      case 'update_firewall_rule':
        return this.updateFirewallRule(params.zoneId as string, params.ruleId as string, params as any);
      case 'delete_firewall_rule':
        return this.deleteFirewallRule(params.zoneId as string, params.ruleId as string);
      case 'get_firewall_filters':
        return this.getFirewallFilters(params.zoneId as string);
      case 'create_firewall_filter':
        return this.createFirewallFilter(params.zoneId as string, params as any);
      case 'get_ip_lists':
        return this.getIPLists(params.accountId as string);
      case 'create_ip_list':
        return this.createIPList(params.accountId as string, params as any);
      case 'delete_ip_list':
        return this.deleteIPList(params.accountId as string, params.listId as string);
      case 'get_ip_list_items':
        return this.getIPListItems(params.accountId as string, params.listId as string);
      case 'create_ip_list_items':
        return this.createIPListItems(params.accountId as string, params.listId as string, params.items as any[]);
      case 'delete_ip_list_items':
        return this.deleteIPListItems(params.accountId as string, params.listId as string, params.items as any[]);
      case 'get_user_agent_rules':
        return this.getUserAgentRules(params.zoneId as string);
      case 'create_user_agent_rule':
        return this.createUserAgentRule(params.zoneId as string, params as any);
      case 'delete_user_agent_rule':
        return this.deleteUserAgentRule(params.zoneId as string, params.ruleId as string);
      case 'get_rate_limits':
        return this.getRateLimits(params.zoneId as string);
      case 'create_rate_limit':
        return this.createRateLimit(params.zoneId as string, params as any);
      case 'update_rate_limit':
        return this.updateRateLimit(params.zoneId as string, params.limitId as string, params as any);
      case 'delete_rate_limit':
        return this.deleteRateLimit(params.zoneId as string, params.limitId as string);
      case 'get_custom_certificates':
        return this.getCustomCertificates(params.zoneId as string);
      case 'upload_custom_certificate':
        return this.uploadCustomCertificate(params.zoneId as string, params as any);
      case 'delete_custom_certificate':
        return this.deleteCustomCertificate(params.zoneId as string, params.certId as string);
      case 'get_ssl_certificates':
        return this.getSSLCertificates(params.zoneId as string);
      case 'get_load_balancers':
        return this.getLoadBalancers(params.zoneId as string);
      case 'create_load_balancer':
        return this.createLoadBalancer(params.zoneId as string, params as any);
      case 'update_load_balancer':
        return this.updateLoadBalancer(params.zoneId as string, params.lbId as string, params as any);
      case 'delete_load_balancer':
        return this.deleteLoadBalancer(params.zoneId as string, params.lbId as string);
      case 'get_lb_pools':
        return this.getLoadBalancerPools(params.zoneId as string);
      case 'create_lb_pool':
        return this.createLoadBalancerPool(params.zoneId as string, params as any);
      case 'update_lb_pool':
        return this.updateLoadBalancerPool(params.zoneId as string, params.poolId as string, params as any);
      case 'delete_lb_pool':
        return this.deleteLoadBalancerPool(params.zoneId as string, params.poolId as string);
      case 'get_lb_monitors':
        return this.getLoadBalancerMonitors(params.zoneId as string);
      case 'create_lb_monitor':
        return this.createLoadBalancerMonitor(params.zoneId as string, params as any);
      case 'update_lb_monitor':
        return this.updateLoadBalancerMonitor(params.zoneId as string, params.monitorId as string, params as any);
      case 'delete_lb_monitor':
        return this.deleteLoadBalancerMonitor(params.zoneId as string, params.monitorId as string);
      case 'get_access_groups':
        return this.getAccessGroups(params.accountId as string);
      case 'create_access_group':
        return this.createAccessGroup(params.accountId as string, params as any);
      case 'update_access_group':
        return this.updateAccessGroup(params.accountId as string, params.groupId as string, params as any);
      case 'delete_access_group':
        return this.deleteAccessGroup(params.accountId as string, params.groupId as string);
      case 'get_access_apps':
        return this.getAccessApplications(params.accountId as string);
      case 'create_access_app':
        return this.createAccessApplication(params.accountId as string, params as any);
      case 'update_access_app':
        return this.updateAccessApplication(params.accountId as string, params.appId as string, params as any);
      case 'delete_access_app':
        return this.deleteAccessApplication(params.accountId as string, params.appId as string);
      case 'get_access_service_tokens':
        return this.getAccessServiceTokens(params.accountId as string);
      case 'create_service_token':
        return this.createAccessServiceToken(params.accountId as string, params as any);
      case 'delete_service_token':
        return this.deleteAccessServiceToken(params.accountId as string, params.tokenId as string);
      case 'get_access_idps':
        return this.getAccessIdentityProviders(params.accountId as string);
      case 'create_idp':
        return this.createAccessIdentityProvider(params.accountId as string, params as any);
      case 'update_idp':
        return this.updateAccessIdentityProvider(params.accountId as string, params.idpId as string, params as any);
      case 'delete_idp':
        return this.deleteAccessIdentityProvider(params.accountId as string, params.idpId as string);
      case 'get_waf_packages':
        return this.getWAFPackages(params.zoneId as string);
      case 'get_waf_rules':
        return this.getWAFRules(params.zoneId as string, params.packageId as string);
      case 'update_waf_rule':
        return this.updateWAFRule(params.zoneId as string, params.packageId as string, params.ruleId as string, params as any);
      case 'get_zone_analytics':
        return this.getZoneAnalytics(params.zoneId as string, params as any);
      case 'purge_cache':
        return this.purgeCache(params.zoneId as string, params as any);
      case 'get_waiting_rooms':
        return this.getWaitingRooms(params.zoneId as string);
      case 'create_waiting_room':
        return this.createWaitingRoom(params.zoneId as string, params as any);
      case 'update_waiting_room':
        return this.updateWaitingRoom(params.zoneId as string, params.roomId as string, params as any);
      case 'delete_waiting_room':
        return this.deleteWaitingRoom(params.zoneId as string, params.roomId as string);
      case 'get_cloudflare_ips':
        return this.getCloudflareIPs();
      case 'test_connection':
        return this.testConnection();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'accounts':
        return this.getAccounts();
      case 'account':
        return this.getAccount(options?.accountId as string);
      case 'zones':
        return this.getZones(options as any);
      case 'zone':
        return this.getZone(options?.zoneId as string);
      case 'dns-records':
        return this.getDNSRecords(options?.zoneId as string, options as any);
      case 'workers':
        return this.getWorkers(options?.accountId as string);
      case 'worker':
        return this.getWorker(options?.accountId as string, options?.scriptName as string);
      case 'kv-namespaces':
        return this.getWorkerKVNamespaces(options?.accountId as string);
      case 'kv-keys':
        return this.getWorkerKVKeys(options?.accountId as string, options?.namespaceId as string, options as any);
      case 'd1-databases':
        return this.getWorkerD1Databases(options?.accountId as string);
      case 'r2-buckets':
        return this.getWorkerR2Buckets(options?.accountId as string);
      case 'pages-projects':
        return this.getPagesProjects(options?.accountId as string);
      case 'pages-deployments':
        return this.getPagesDeployments(options?.accountId as string, options?.projectName as string);
      case 'page-rules':
        return this.getPageRules(options?.zoneId as string);
      case 'firewall-rules':
        return this.getFirewallRules(options?.zoneId as string);
      case 'rate-limits':
        return this.getRateLimits(options?.zoneId as string);
      case 'load-balancers':
        return this.getLoadBalancers(options?.zoneId as string);
      case 'lb-pools':
        return this.getLoadBalancerPools(options?.zoneId as string);
      case 'waf-packages':
        return this.getWAFPackages(options?.zoneId as string);
      case 'analytics':
        return this.getZoneAnalytics(options?.zoneId as string, options as any);
      case 'ip-lists':
        return this.getIPLists(options?.accountId as string);
      case 'waiting-rooms':
        return this.getWaitingRooms(options?.zoneId as string);
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
}

export const cloudflarePlugin = new CloudflarePlugin();

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  keywords: string[];
  actions?: Array<{ id: string; name: string; description: string }>;
  triggers?: Array<{ id: string; name: string; description: string }>;
  auth?: {
    type: string;
    fields: Array<{ name: string; label: string; description: string; required?: boolean; type?: string; options?: string[]; default?: any }>;
  };
  settings?: Array<{ name: string; label: string; type: string; default?: any; options?: string[] }>;
  connectionTest?: { endpoint: string; method: string };
}