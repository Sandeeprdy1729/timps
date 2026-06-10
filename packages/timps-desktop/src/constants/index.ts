/**
 * TIMPS Desktop Constants
 * Centralized constants for the desktop app.
 */

export const APP = {
  name: 'TIMPS',
  version: '0.1.0',
  description: 'The AI Coding Agent That Remembers',
  homepage: 'https://timps.dev',
  repository: 'https://github.com/Sandeeprdy1729/timps',
} as const;

export const SERVER = {
  defaultUrl: 'http://localhost:3000',
  timeout: 30000,
  retries: 3,
} as const;

export const PROVIDERS = [
  { name: 'auto', label: 'Provider Mesh Auto Route', defaultModel: 'auto', url: 'timps://provider-mesh', category: 'router' },
  { name: 'openai', label: 'OpenAI', defaultModel: 'auto', url: 'https://api.openai.com/v1', category: 'frontier' },
  { name: 'anthropic', label: 'Anthropic Claude', defaultModel: 'auto', url: 'https://api.anthropic.com', category: 'frontier' },
  { name: 'gemini', label: 'Google Gemini', defaultModel: 'auto', url: 'https://generativelanguage.googleapis.com', category: 'frontier' },
  { name: 'xai', label: 'xAI', defaultModel: 'auto', url: 'https://api.x.ai/v1', category: 'frontier' },
  { name: 'deepseek', label: 'DeepSeek', defaultModel: 'auto', url: 'https://api.deepseek.com/v1', category: 'frontier' },
  { name: 'mistral', label: 'Mistral', defaultModel: 'auto', url: 'https://api.mistral.ai/v1', category: 'frontier' },
  { name: 'openrouter', label: 'OpenRouter', defaultModel: 'auto', url: 'https://openrouter.ai/api/v1', category: 'router' },
  { name: 'groq', label: 'Groq', defaultModel: 'auto', url: 'https://api.groq.com/openai/v1', category: 'router' },
  { name: 'together', label: 'Together AI', defaultModel: 'auto', url: 'https://api.together.xyz/v1', category: 'router' },
  { name: 'fireworks', label: 'Fireworks AI', defaultModel: 'auto', url: 'https://api.fireworks.ai/inference/v1', category: 'router' },
  { name: 'cohere', label: 'Cohere', defaultModel: 'auto', url: 'https://api.cohere.com/v2', category: 'frontier' },
  { name: 'perplexity', label: 'Perplexity', defaultModel: 'auto', url: 'https://api.perplexity.ai', category: 'frontier' },
  { name: 'azure-openai', label: 'Azure OpenAI', defaultModel: 'auto', url: 'https://{resource}.openai.azure.com', category: 'enterprise' },
  { name: 'bedrock', label: 'AWS Bedrock', defaultModel: 'auto', url: 'aws://bedrock', category: 'enterprise' },
  { name: 'ollama', label: 'Ollama', defaultModel: 'auto', url: 'http://localhost:11434', category: 'local-open' },
  { name: 'lmstudio', label: 'LM Studio', defaultModel: 'auto', url: 'http://localhost:1234/v1', category: 'local-open' },
  { name: 'jan', label: 'Jan', defaultModel: 'auto', url: 'http://localhost:1337/v1', category: 'local-open' },
  { name: 'vllm', label: 'vLLM', defaultModel: 'auto', url: 'http://localhost:8000/v1', category: 'local-open' },
] as const;

export const MEMORY = {
  maxSemantic: 500,
  maxEpisodes: 100,
  maxWorkingGoals: 10,
  maxActiveFiles: 20,
  maxRecentErrors: 10,
} as const;

export const UI = {
  sidebarWidth: 220,
  headerHeight: 60,
  maxSearchResults: 20,
  defaultEpisodeCount: 50,
  debounceDelay: 300,
} as const;

export const KEYBOARD = {
  shortcuts: {
    showWindow: 'CommandOrControl+Shift+T',
    quickCapture: 'CommandOrControl+Shift+N',
    commandBar: 'CommandOrControl+Shift+K',
  },
} as const;

export const STORAGE_KEYS = {
  lastProject: 'lastProject',
  provider: 'provider',
  model: 'model',
  theme: 'theme',
  serverUrl: 'serverUrl',
} as const;

export const EVENTS = {
  showQuickCapture: 'show-quick-capture',
  showSettings: 'show-settings',
  showCommandBar: 'show-command-bar',
  memoryUpdated: 'memory-updated',
  projectChanged: 'project-changed',
} as const;

export const REGEX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/.+/,
  path: /^\/[^\0]+$/,
  hash: /^[a-f0-9]{12}$/,
} as const;

export const ERROR_MESSAGES = {
  projectNotFound: 'Project not found',
  networkError: 'Network error. Please check your connection.',
  serverError: 'Server error. Please try again.',
  invalidPath: 'Invalid project path',
  unauthorized: 'Authentication required',
  notFound: 'Resource not found',
} as const;
