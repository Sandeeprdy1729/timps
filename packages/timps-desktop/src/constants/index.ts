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
  { name: 'ollama', label: 'Ollama', defaultModel: 'qwen2.5-coder:7b', url: 'http://localhost:11434' },
  { name: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o', url: 'https://api.openai.com/v1' },
  { name: 'claude', label: 'Anthropic Claude', defaultModel: 'claude-sonnet-4-5', url: 'https://api.anthropic.com' },
  { name: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.0-flash', url: 'https://generativelanguage.googleapis.com' },
  { name: 'deepseek', label: 'DeepSeek', defaultModel: 'deepseek-chat', url: 'https://api.deepseek.com/v1' },
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