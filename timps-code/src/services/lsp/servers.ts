// TIMPS Code — LSP Servers Configuration

export interface LspServerConfig {
  name: string;
  command: string;
  args?: string[];
  filetypes?: string[];
  rootPatterns?: string[];
}

export const availableServers: LspServerConfig[] = [
  {
    name: 'typescript',
    command: 'typescript-language-server',
    args: ['--stdio'],
    filetypes: ['typescript', 'javascript', 'tsx', 'jsx'],
    rootPatterns: ['tsconfig.json', 'jsconfig.json'],
  },
  {
    name: 'python',
    command: 'python',
    args: ['-m', 'pyright-langserver', '--stdio'],
    filetypes: ['python'],
    rootPatterns: ['pyproject.toml', 'requirements.txt'],
  },
  {
    name: 'rust',
    command: 'rust-analyzer',
    args: [],
    filetypes: ['rust'],
    rootPatterns: ['Cargo.toml'],
  },
  {
    name: 'go',
    command: 'gopls',
    args: [],
    filetypes: ['go'],
    rootPatterns: ['go.mod'],
  },
  {
    name: 'json',
    command: 'vscode-json-languageserver',
    args: ['--stdio'],
    filetypes: ['json'],
  },
  {
    name: 'html',
    command: 'vscode-html-languageserver',
    args: ['--stdio'],
    filetypes: ['html', 'htm'],
  },
  {
    name: 'css',
    command: 'vscode-css-languageserver',
    args: ['--stdio'],
    filetypes: ['css', 'scss', 'less'],
  },
  {
    name: 'yaml',
    command: 'yaml-language-server',
    args: ['--stdio'],
    filetypes: ['yaml', 'yml'],
  },
  {
    name: 'markdown',
    command: ' Markserver',
    args: ['--stdio'],
    filetypes: ['markdown'],
  },
  {
    name: 'vue',
    command: 'vue-language-server',
    args: ['--stdio'],
    filetypes: ['vue'],
  },
  {
    name: 'svelte',
    command: 'svelteserver',
    args: ['--stdio'],
    filetypes: ['svelte'],
  },
  {
    name: 'php',
    command: 'phpactor',
    args: ['server', 'start'],
    filetypes: ['php'],
  },
];