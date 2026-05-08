import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class LanguageModelPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/lm-api',
    name: 'Language Model API',
    version: '1.0.0',
    description: 'Direct access to AI language models in VS Code',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['ai', 'lm', 'language model', 'copilot', 'anthropic'],
  };

  public capabilities: PluginCapabilities = {};

  async request(model: string, messages: ChatMessage[], options?: LmOptions): Promise<LmResponse> {
    const response: LmResponse = {
      message: { role: 'assistant', content: '' },
      model,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    };
    return response;
  }

  async *streamRequest(model: string, messages: ChatMessage[], options?: LmOptions): AsyncGenerator<string, void, unknown> {
    yield '';
  }

  selectModel(options?: ModelSelectorOptions): string {
    const models = this.listModels(options);
    return models[0]?.identifier || 'default';
  }

  listModels(options?: ModelSelectorOptions): LanguageModel[] {
    return [
      { identifier: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', vendor: 'Anthropic', contextWindow: 200000 },
      { identifier: 'claude-3-opus-20240229', name: 'Claude 3 Opus', vendor: 'Anthropic', contextWindow: 200000 },
      { identifier: 'gpt-4o', name: 'GPT-4o', vendor: 'OpenAI', contextWindow: 128000 },
      { identifier: 'gpt-4o-mini', name: 'GPT-4o Mini', vendor: 'OpenAI', contextWindow: 128000 },
    ];
  }

  countTokens(text: string, model?: string): number {
    const words = text.split(/\s+/).length;
    return Math.ceil(words * 1.3);
  }

  estimateCost(tokens: number, model: string): number {
    const rates: Record<string, { input: number; output: number }> = {
      'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
      'claude-3-opus-20240229': { input: 15, output: 75 },
      'gpt-4o': { input: 2.5, output: 10 },
      'gpt-4o-mini': { input: 0.075, output: 0.3 },
    };
    const rate = rates[model] || { input: 1, output: 1 };
    return (tokens * rate.input) / 1000000;
  }

  async requestWithTools(model: string, messages: ChatMessage[], tools: ToolDefinition[], options?: LmOptions): Promise<LmToolResponse> {
    return {
      message: { role: 'assistant', content: '', toolCalls: [] },
      model,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    };
  }

  getModelCapabilities(model: string): ModelCapabilities {
    const capabilities: Record<string, ModelCapabilities> = {
      'claude-3-5-sonnet-20241022': {
        maxTokens: 8192,
        supportsVision: true,
        supportsJson: true,
        supportsTools: true,
        supportsStreaming: true,
        supportsSystemPrompt: true,
        supportsThinking: false,
      },
      'gpt-4o': {
        maxTokens: 16384,
        supportsVision: true,
        supportsJson: true,
        supportsTools: true,
        supportsStreaming: true,
        supportsSystemPrompt: true,
        supportsThinking: false,
      },
    };
    return capabilities[model] || { maxTokens: 4096, supportsVision: false, supportsJson: true, supportsTools: true, supportsStreaming: true, supportsSystemPrompt: true, supportsThinking: false };
  }

  setSystemPrompt(prompt: string): void {}

  getSystemPrompt(): string {
    return '';
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LmOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  stream?: boolean;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'any' | { type: 'function'; function: { name: string } };
  thinking?: { type: 'enabled'; budgetTokens?: number };
}

export interface LmResponse {
  message: { role: string; content: string; toolCalls?: ToolCall[] };
  model: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export interface LmToolResponse extends LmResponse {}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LanguageModel {
  identifier: string;
  name: string;
  vendor: string;
  contextWindow: number;
}

export interface ModelSelectorOptions {
  vendor?: string;
  capability?: string;
  maxContext?: number;
}

export interface ModelCapabilities {
  maxTokens: number;
  supportsVision: boolean;
  supportsJson: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsSystemPrompt: boolean;
  supportsThinking: boolean;
}

export class LanguageModelToolPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/lm-tool',
    name: 'Language Model Tool',
    version: '1.0.0',
    description: 'Register tools for AI to invoke automatically in agent mode',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['ai', 'tool', 'agent', 'automatic'],
  };

  public capabilities: PluginCapabilities = {};

  private tools: Map<string, LmTool> = new Map();

  register(tool: LmTool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  list(): LmTool[] {
    return Array.from(this.tools.values());
  }

  invoke(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return Promise.reject(new Error(`Tool not found: ${name}`));
    }
    return tool.execute(params);
  }

  validateParams(name: string, params: Record<string, unknown>): ValidationResult {
    const tool = this.tools.get(name);
    if (!tool) {
      return { valid: false, errors: [`Tool not found: ${name}`] };
    }

    const errors: string[] = [];
    const schema = tool.inputSchema;

    if (schema.required) {
      for (const requiredField of schema.required as string[]) {
        if (!(requiredField in params) || params[requiredField] === undefined) {
          errors.push(`Missing required field: ${requiredField}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  getSchema(name: string): Record<string, unknown> | null {
    const tool = this.tools.get(name);
    return tool?.inputSchema || null;
  }

  shouldInvoke(prompt: string, context: ToolContext): string | null {
    const tools = this.list();
    for (const tool of tools) {
      if (tool.shouldInvoke && tool.shouldInvoke(prompt, context)) {
        return tool.name;
      }
    }
    return null;
  }

  getConfirmationMessage(tool: LmTool, params: Record<string, unknown>): string {
    return `Execute tool ${tool.name} with params: ${JSON.stringify(params)}`;
  }

  createTool(name: string, description: string, inputSchema: Record<string, unknown>, executeFn: (params: Record<string, unknown>) => Promise<unknown>): LmTool {
    return new LmToolImpl(name, description, inputSchema, executeFn);
  }
}

export interface LmTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(params: Record<string, unknown>): Promise<unknown>;
  shouldInvoke?(prompt: string, context: ToolContext): boolean;
  prepareInvocation?(params: Record<string, unknown>): Promise<string>;
}

export class LmToolImpl implements LmTool {
  constructor(
    public name: string,
    public description: string,
    public inputSchema: Record<string, unknown>,
    private executeFn: (params: Record<string, unknown>) => Promise<unknown>
  ) {}

  async execute(params: Record<string, unknown>): Promise<unknown> {
    return this.executeFn(params);
  }
}

export interface ToolContext {
  activeDocument?: string;
  openDocuments?: string[];
  selection?: { start: Position; end: Position };
  cursorPosition?: Position;
  debugSession?: boolean;
  terminalCount?: number;
}

export interface Position {
  line: number;
  column: number;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
  errorMessage?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class PromptTemplatePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/prompt-template',
    name: 'Prompt Template',
    version: '1.0.0',
    description: 'Create structured prompts with Prompt TSX patterns',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['prompt', 'template', 'tsx', 'context'],
  };

  public capabilities: PluginCapabilities = {};

  create(template: string): PromptTemplate {
    return new PromptTemplate(template);
  }

  render(template: PromptTemplate, context: Record<string, unknown>): string {
    return template.render(context);
  }

  compose(...templates: PromptTemplate[]): ComposedPrompt {
    return new ComposedPrompt(templates);
  }

  withSystem(prompt: PromptTemplate, systemPrompt: string): PromptTemplate {
    const original = prompt.template;
    return new PromptTemplate(`System: ${systemPrompt}\n\n${original}`);
  }

  withContext(prompt: PromptTemplate, contextSnippet: ContextSnippet): PromptTemplate {
    const contextStr = this.formatContext(contextSnippet);
    const original = prompt.template;
    return new PromptTemplate(`${contextStr}\n\n${original}`);
  }

  private formatContext(snippet: ContextSnippet): string {
    const parts: string[] = [];
    if (snippet.files?.length) {
      parts.push(`## Relevant Files:\n${snippet.files.map(f => `- ${f.path}: ${f.content?.slice(0, 200)}...`).join('\n')}`);
    }
    if (snippet.definitions?.length) {
      parts.push(`## Definitions:\n${snippet.definitions.map(d => `- ${d.name} in ${d.file}`).join('\n')}`);
    }
    if (snippet.commands?.length) {
      parts.push(`## Recent Commands:\n${snippet.commands.map(c => `- ${c}`).join('\n')}`);
    }
    return parts.join('\n\n');
  }

  createRepositoryMap(files: FileInfo[]): string {
    const tree = this.buildFileTree(files);
    return `## Repository Structure:\n${tree}`;
  }

  private buildFileTree(files: FileInfo[], prefix = ''): string {
    const grouped: Record<string, FileInfo[]> = {};
    for (const file of files) {
      const parts = file.path.split('/');
      const key = parts[0] || 'root';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ ...file, path: parts.slice(1).join('/') });
    }

    let result = '';
    for (const [dir, files] of Object.entries(grouped)) {
      result += `${prefix}${dir}/\n`;
      result += this.buildFileTree(files, prefix + '  ');
    }
    return result;
  }
}

export class PromptTemplate {
  constructor(public template: string) {}

  render(context: Record<string, unknown>): string {
    let result = this.template;
    for (const [key, value] of Object.entries(context)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(placeholder, String(value));
    }
    return result;
  }

  partial(context: Partial<Record<string, unknown>>): PartialPrompt {
    return new PartialPrompt(this.template, context);
  }
}

export class PartialPrompt {
  private context: Partial<Record<string, unknown>>;

  constructor(private template: string, context: Partial<Record<string, unknown>>) {
    this.context = context;
  }

  render(additional: Record<string, unknown>): string {
    const allContext = { ...this.context, ...additional };
    let result = this.template;
    for (const [key, value] of Object.entries(allContext)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(placeholder, String(value));
    }
    return result;
  }
}

export class ComposedPrompt {
  constructor(private templates: PromptTemplate[]) {}

  render(context: Record<string, unknown>): string {
    return this.templates.map(t => t.render(context)).join('\n\n');
  }
}

export interface ContextSnippet {
  files?: Array<{ path: string; content?: string }>;
  definitions?: Array<{ name: string; file: string }>;
  commands?: string[];
}

export interface FileInfo {
  path: string;
  type?: string;
  size?: number;
}

export class ChatParticipantPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/chat-participant',
    name: 'Chat Participant',
    version: '1.0.0',
    description: 'Create @-mentionable AI assistants in VS Code',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['chat', 'participant', 'assistant', '@'],
  };

  public capabilities: PluginCapabilities = {};

  private participants: Map<string, ChatParticipant> = new Map();

  create(config: ParticipantConfig): ChatParticipant {
    return new ChatParticipant(config);
  }

  register(participant: ChatParticipant): void {
    this.participants.set(participant.name, participant);
  }

  unregister(name: string): void {
    this.participants.delete(name);
  }

  list(): ChatParticipant[] {
    return Array.from(this.participants.values());
  }

  handleMessage(name: string, message: string, context: ParticipantContext): Promise<ParticipantResponse> {
    const participant = this.participants.get(name);
    if (!participant) {
      return Promise.reject(new Error(`Participant not found: ${name}`));
    }
    return participant.handleMessage(message, context);
  }

  addSlashCommand(participant: ChatParticipant, command: SlashCommand): void {
    participant.commands.push(command);
  }

  provideDetectionExamples(participant: ChatParticipant, examples: string[]): void {
    participant.detectionExamples = examples;
  }

  createResponder(participant: ChatParticipant, pattern: string, responseFn: (match: RegExpMatchArray) => string): void {
    participant.respondents.push({ pattern: new RegExp(pattern), responseFn });
  }
}

export interface ParticipantConfig {
  name: string;
  description: string;
  icon?: string;
  theme?: string;
}

export class ChatParticipant {
  public commands: SlashCommand[] = [];
  public detectionExamples: string[] = [];
  public respondents: Array<{ pattern: RegExp; responseFn: (match: RegExpMatchArray) => string }> = [];

  constructor(public config: ParticipantConfig) {}

  get name(): string {
    return this.config.name;
  }

  get description(): string {
    return this.config.description;
  }

  async handleMessage(message: string, context: ParticipantContext): Promise<ParticipantResponse> {
    return { content: 'Not implemented', followUp: [] };
  }
}

export interface SlashCommand {
  name: string;
  description: string;
  execute(args: string): Promise<string>;
}

export interface ParticipantContext {
  document?: string;
  selection?: string;
  uri?: string;
  cursorPosition?: Position;
}

export interface ParticipantResponse {
  content: string;
  followUp?: string[];
  errors?: string[];
}

export class AgentCustomizationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/agent-customization',
    name: 'Agent Customization',
    version: '1.0.0',
    description: 'Configure agent instructions, hooks, and behaviors',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['agent', 'customization', 'instructions', 'hook'],
  };

  public capabilities: PluginCapabilities = {};

  createInstructions(config: InstructionsConfig): Instructions {
    return new Instructions(config);
  }

  createHook(hook: HookConfig): Hook {
    return new Hook(hook);
  }

  createSkill(skill: SkillConfig): Skill {
    return new Skill(skill);
  }

  createAgent(agent: AgentConfig): Agent {
    return new Agent(agent);
  }

  alwaysOn(name: string, content: string): AlwaysOnInstruction {
    return new AlwaysOnInstruction(name, content);
  }

  fileBased(pathPattern: string, content: string): FileBasedInstruction {
    return new FileBasedInstruction(pathPattern, content);
  }

  when(condition: string, content: string): ConditionalInstruction {
    return new ConditionalInstruction(condition, content);
  }
}

export class Instructions {
  constructor(private config: InstructionsConfig) {}

  getContent(): string {
    return this.config.content;
  }

  getScope(): 'always' | 'file' | 'when' {
    return this.config.scope;
  }

  matches(path: string): boolean {
    if (this.config.scope === 'file') {
      const pattern = new RegExp(this.config.pathPattern || '.*');
      return pattern.test(path);
    }
    return true;
  }
}

export class AlwaysOnInstruction extends Instructions {}

export class FileBasedInstruction extends Instructions {
  private pathPattern: string;

  constructor(pathPattern: string, content: string) {
    super({ scope: 'file', pathPattern, content });
    this.pathPattern = pathPattern;
  }

  matches(path: string): boolean {
    return new RegExp(this.pathPattern).test(path);
  }
}

export class ConditionalInstruction extends Instructions {
  private condition: string;

  constructor(condition: string, content: string) {
    super({ scope: 'when', condition, content });
    this.condition = condition;
  }

  evaluate(context: Record<string, unknown>): boolean {
    const [key, expected] = this.condition.split('=');
    return String(context[key]) === expected;
  }
}

export interface InstructionsConfig {
  content: string;
  scope?: 'always' | 'file' | 'when';
  pathPattern?: string;
  condition?: string;
}

export class Hook {
  constructor(private config: HookConfig) {}

  getTrigger(): string {
    return this.config.trigger;
  }

  getAction(): string {
    return this.config.action;
  }

  async execute(context: HookContext): Promise<void> {
    return;
  }
}

export interface HookConfig {
  trigger: 'onEdit' | 'onSave' | 'onOpen' | 'onCommand' | 'onDiff';
  action: string;
  command?: string;
}

export interface HookContext {
  document?: string;
  uri?: string;
  diff?: string;
}

export class Skill {
  constructor(private config: SkillConfig) {}

  getName(): string {
    return this.config.name;
  }

  getDescription(): string {
    return this.config.description;
  }

  async execute(args: string[]): Promise<string> {
    return '';
  }
}

export interface SkillConfig {
  name: string;
  description: string;
  parameters?: SkillParameter[];
}

export interface SkillParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export class Agent {
  constructor(private config: AgentConfig) {}

  getPersona(): string {
    return this.config.persona;
  }

  getTools(): string[] {
    return this.config.tools || [];
  }

  getInstructions(): string {
    return this.config.instructions || '';
  }
}

export interface AgentConfig {
  name: string;
  persona: string;
  instructions?: string;
  tools?: string[];
  model?: string;
}

export class McpServerPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/mcp-server',
    name: 'MCP Server',
    version: '1.0.0',
    description: 'Build MCP servers for external AI tools',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['mcp', 'server', 'tool', 'external'],
  };

  public capabilities: PluginCapabilities = {};

  createServer(config: McpConfig): McpServer {
    return new McpServer(config);
  }

  createTool(tool: McpTool): McpServer {
    return McpServer.from(tool);
  }

  createResource(resource: McpResource): McpServer {
    return McpServer.from(resource);
  }

  createPrompt(prompt: McpPrompt): McpServer {
    return McpServer.from(prompt);
  }

  stdio(config: McpConfig): McpStdioServer {
    return new McpStdioServer(config);
  }

  http(config: McpConfig): McpHttpServer {
    return new McpHttpServer(config);
  }

  buildToolSchema(tool: ToolDefinition): Record<string, unknown> {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    };
  }

  buildResourceSchema(resource: McpResource): Record<string, unknown> {
    return {
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    };
  }

  buildPromptSchema(prompt: McpPrompt): Record<string, unknown> {
    return {
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    };
  }
}

export class McpServer {
  private tools: McpTool[] = [];
  private resources: McpResource[] = [];
  private prompts: McpPrompt[] = [];

  constructor(private config: McpConfig) {}

  static from(tool: McpTool | McpResource | McpPrompt): McpServer {
    const server = new McpServer({ name: 'inline', version: '1.0.0' });
    if ('uri' in tool && !('arguments' in tool)) {
      server.resources.push(tool as McpResource);
    } else if ('arguments' in tool) {
      server.prompts.push(tool as McpPrompt);
    } else {
      server.tools.push(tool as McpTool);
    }
    return server;
  }

  addTool(tool: McpTool): this {
    this.tools.push(tool);
    return this;
  }

  addResource(resource: McpResource): this {
    this.resources.push(resource);
    return this;
  }

  addPrompt(prompt: McpPrompt): this {
    this.prompts.push(prompt);
    return this;
  }

  getTools(): McpTool[] {
    return this.tools;
  }

  getResources(): McpResource[] {
    return this.resources;
  }

  getPrompts(): McpPrompt[] {
    return this.prompts;
  }

  async handleRequest(request: McpRequest): Promise<McpResponse> {
    if (request.method === 'tools/list') {
      return { tools: this.tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) };
    }
    if (request.method === 'resources/list') {
      return { resources: this.resources.map(r => ({ uri: r.uri, name: r.name, description: r.description })) };
    }
    if (request.method === 'prompts/list') {
      return { prompts: this.prompts.map(p => ({ name: p.name, description: p.description })) };
    }
    return { error: { code: 'method_not_found', message: 'Unknown method' } };
  }
}

export class McpStdioServer extends McpServer {
  run(): void {}
}

export class McpHttpServer extends McpServer {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}

export interface McpConfig {
  name: string;
  version: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(params: Record<string, unknown>): Promise<unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  content: string;
}

export interface McpPrompt {
  name: string;
  description: string;
  arguments?: Array<{ name: string; type: string; required: boolean }>;
  render(args: Record<string, string>): string;
}

export interface McpRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  resources?: Array<{ uri: string; name: string; description: string }>;
  prompts?: Array<{ name: string; description: string }>;
  error?: { code: string; message: string };
}