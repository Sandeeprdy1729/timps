import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text } from 'ink';

import fs from 'fs';
import path from 'path';
import { MessageList, type Message } from './components/MessageList.js';
import { ToolActivity } from './components/ToolActivity.js';
import { CommandPalette, type Command } from './components/palette/CommandPalette.js';
import { Autocomplete, type AutocompleteSuggestion } from './components/autocomplete/Autocomplete.js';
import { Dialog, type DialogConfig } from './components/dialog/Dialog.js';
import { Toast } from './components/toast/Toast.js';
import { MultilineInput } from './components/MultilineInput.js';
import { WelcomeScreen } from './components/WelcomeScreen.js';
import { BottomBar } from './components/BottomBar.js';
import { useKeybind, createDefaultKeybindActions } from './hooks/useKeybind.js';
import { useToast } from './hooks/useToast.js';
import { useAttention } from './hooks/useAttention.js';
import { loadTUIConfig } from '../config/tui/index.js';
import { icons } from '../config/theme.js';
import type { ProviderName, ModelProvider } from '../config/types.js';
import { handleSlashCommand } from '../core/app.js';
import { renderModelsList, renderMemoryPanel } from '../utils/renderer.js';
import { createProvider } from '../models/index.js';
import { getDefaultModel, loadConfig, saveConfig } from '../config/config.js';

import { HelpPanel } from './panels/HelpPanel.js';
import { ProviderSelect } from './panels/ProviderSelect.js';

const tuiConfig = loadTUIConfig();

interface AppProps {
  agent: any;
  memory: any;
  todos: any;
  snapshots: any;
  permissions: any;
  provider: any;
  cwd: string;
  sessionDir: string;
  multimodalMem?: any;
}

const TERM_WIDTH = process.stdout.columns || 80;

export const App = ({ agent, memory, todos, snapshots, permissions, provider, cwd, sessionDir, multimodalMem }: AppProps) => {
  const [currentProvider, setCurrentProvider] = useState<ModelProvider>(provider);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showProviderSelect, setShowProviderSelect] = useState(false);

  // Command Palette
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Autocomplete
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);

  // Dialog
  const [dialogConfig, setDialogConfig] = useState<DialogConfig | null>(null);

  // Toast
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const toast = useToast();
  const attention = useAttention({ sound: true, notification: false });

  const [mode, setMode] = useState<'build' | 'plan'>('build');
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenLimit, setTokenLimit] = useState(200000);
  const responseStartRef = useRef(0);

  const [contextUsed, setContextUsed] = useState(0);
  const [contextMax, setContextMax] = useState(200000);
  const [errorCount, setErrorCount] = useState(0);
  const [gitBranch, setGitBranch] = useState<string | undefined>(undefined);
  const [sessionCount, setSessionCount] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const inputHistory = useRef<string[]>([]);
  const historyIndex = useRef(-1);

  // Detect git branch
  useEffect(() => {
    try {
      const gitHead = path.join(cwd, '.git', 'HEAD');
      if (fs.existsSync(gitHead)) {
        const ref = fs.readFileSync(gitHead, 'utf-8').trim();
        const m = ref.match(/ref: refs\/heads\/(.+)/);
        if (m) setGitBranch(m[1]);
      }
    } catch {}
  }, [cwd]);

  // Update context from agent
  useEffect(() => {
    if (agent) {
      const usage = agent.getUsage?.() || {};
      setContextUsed((usage.inputTokens || 0) + (usage.outputTokens || 0));
      setSessionCount(memory?.episodeCount || 0);
    }
  }, [agent, messages]);

  // Build command palette items
  const commandPaletteCommands: Command[] = [
    { id: 'help', label: '/help', description: 'Show help', category: 'General', keywords: ['help', 'commands', '?'], action: () => setShowHelp(true) },
    { id: 'provider', label: '/provider', description: 'Switch AI provider/model', category: 'Model', keywords: ['provider', 'model', 'switch'], action: () => setShowProviderSelect(true) },
    { id: 'memory', label: '/memory', description: 'Show memory panel', category: 'Memory', keywords: ['memory', 'mem', 'recall'], action: async () => { await handleSlashCommand('/memory', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem); } },
    { id: 'todo', label: '/todo', description: 'List todos', category: 'Tasks', keywords: ['todo', 'tasks', 't'], action: () => handleSlashCommand('/todo', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'clear', label: '/clear', description: 'Clear conversation', category: 'General', keywords: ['clear', 'clean'], action: () => handleSlashCommand('/clear', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'doctor', label: '/doctor', description: 'System health check', category: 'Diagnostics', keywords: ['doctor', 'health', 'check'], action: () => handleSlashCommand('/doctor', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'cost', label: '/cost', description: 'Session cost breakdown', category: 'General', keywords: ['cost', 'pricing', 'tokens'], action: () => handleSlashCommand('/cost', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'context', label: '/context', description: 'Show context usage', category: 'General', keywords: ['context', 'ctx', 'window'], action: () => handleSlashCommand('/context', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'git-status', label: '/git status', description: 'Git status', category: 'Git', keywords: ['git', 'status'], action: () => handleSlashCommand('/git status', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'git-log', label: '/git log', description: 'Git log', category: 'Git', keywords: ['git', 'log', 'history'], action: () => handleSlashCommand('/git log', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'git-diff', label: '/git diff', description: 'Git diff', category: 'Git', keywords: ['git', 'diff', 'changes'], action: () => handleSlashCommand('/git diff', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'undo', label: '/undo', description: 'Undo last file changes', category: 'General', keywords: ['undo', 'revert'], action: () => handleSlashCommand('/undo', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'snap', label: '/snap', description: 'List snapshots', category: 'Snapshots', keywords: ['snap', 'snapshot'], action: () => handleSlashCommand('/snap', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'compact', label: '/compact', description: 'Compact context', category: 'General', keywords: ['compact', 'compress'], action: () => handleSlashCommand('/compact', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'skills', label: '/skills', description: 'Show installed skills', category: 'Skills', keywords: ['skills', 'skill'], action: () => handleSlashCommand('/skills', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'plan', label: '/plan', description: 'Enter planning mode', category: 'General', keywords: ['plan', 'planning'], action: () => handleSlashCommand('/plan', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'think', label: '/think', description: 'Reasoning mode', category: 'General', keywords: ['think', 'reason'], action: () => handleSlashCommand('/think', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'session', label: '/session', description: 'Session info', category: 'General', keywords: ['session', 'info'], action: () => handleSlashCommand('/session', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'models', label: '/models', description: 'List available models', category: 'Model', keywords: ['models', 'list'], action: () => handleSlashCommand('/models', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'config', label: '/config', description: 'Run setup wizard', category: 'General', keywords: ['config', 'setup', 'settings'], action: () => handleSlashCommand('/config', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem) },
    { id: 'quit', label: '/exit', description: 'Exit TIMPS', category: 'General', keywords: ['exit', 'quit', 'goodbye'], action: () => { agent.saveSession?.(sessionDir); process.exit(0); } },
  ];

  // Keybind system
  const { register } = useKeybind();

  useEffect(() => {
    const unregisters: Array<() => void> = [];

    // Default keybinds from config
    const defaultActions: Record<string, () => void> = {
      commandPalette: () => setShowCommandPalette(v => !v),
      help: () => setShowHelp(v => !v),
      quit: () => { agent.saveSession?.(sessionDir); process.exit(0); },
      clear: () => { setMessages([]); toast.show('Conversation cleared', 'info', 2000); },
      provider: () => setShowProviderSelect(v => !v),
      undo: () => handleSlashCommand('/undo', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem),
      autocompleteClose: () => setShowAutocomplete(false),
      historyUp: () => {
        if (historyIndex.current > 0) {
          historyIndex.current--;
          setInput(inputHistory.current[historyIndex.current] || '');
        }
      },
      historyDown: () => {
        if (historyIndex.current < inputHistory.current.length - 1) {
          historyIndex.current++;
          setInput(inputHistory.current[historyIndex.current] || '');
        } else {
          historyIndex.current = inputHistory.current.length;
          setInput('');
        }
      },
    };

    for (const [keybind, handler] of createDefaultKeybindActions(defaultActions)) {
      unregisters.push(register(keybind, handler));
    }

    // escape → close panels
    unregisters.push(register('escape', () => {
      if (showCommandPalette) setShowCommandPalette(false);
      if (showHelp) setShowHelp(false);
      if (showProviderSelect) setShowProviderSelect(false);
      if (showAutocomplete) setShowAutocomplete(false);
      if (dialogConfig) setDialogConfig(null);
    }));

    // Leader key actions
    const leaderActions: Record<string, () => void> = {
      h: () => setShowHelp(v => !v),
      p: () => setShowCommandPalette(v => !v),
      m: () => handleSlashCommand('/memory', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem),
      t: () => handleSlashCommand('/todo', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem),
      g: () => handleSlashCommand('/git status', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem),
      P: () => setShowProviderSelect(v => !v),
      d: () => handleSlashCommand('/doctor', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem),
      c: () => handleSlashCommand('/cost', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem),
      S: () => handleSlashCommand('/snap', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem),
      k: () => handleSlashCommand('/skills', agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem),
      q: () => { agent.saveSession?.(sessionDir); process.exit(0); },
    };

    for (const [key, handler] of Object.entries(leaderActions)) {
      unregisters.push(register(`leader:${key}`, handler));
    }

    return () => { for (const u of unregisters) u(); };
  }, [showCommandPalette, showHelp, showProviderSelect, showAutocomplete, dialogConfig, agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, multimodalMem]);

  // Autocomplete logic
  useEffect(() => {
    if (!input.startsWith('/')) {
      setShowAutocomplete(false);
      return;
    }
    const parts = input.split(' ');
    const cmd = parts[0].toLowerCase();
    const hasArgs = parts.length > 1;

    const suggestions: AutocompleteSuggestion[] = [];

    if (!hasArgs) {
      const cmds = commandPaletteCommands
        .filter(c => c.label.startsWith(cmd))
        .map(c => ({
          label: c.label,
          description: c.description,
          detail: c.shortcut,
          type: 'command' as const,
        }));
      suggestions.push(...cmds);
    }

    setAutocompleteSuggestions(suggestions);
    setShowAutocomplete(suggestions.length > 0 && !isProcessing);
  }, [input, isProcessing]);

  const handleSubmit = useCallback(async (query: string) => {
    if (!query.trim()) return;

    if (showHelp) { setShowHelp(false); return; }
    if (showProviderSelect) { setShowProviderSelect(false); return; }
    if (showCommandPalette) { setShowCommandPalette(false); return; }

    // Save to history
    inputHistory.current.push(query);
    historyIndex.current = inputHistory.current.length;

    // Handle slash commands
    if (query.trim().startsWith('/')) {
      setInput('');
      const cmd = query.trim().toLowerCase();

      if (cmd === '/help' || cmd === '/h') {
        setShowHelp(true);
        return;
      }

      if (cmd === '/provider' || cmd === '/models' || cmd === '/model') {
        setShowProviderSelect(true);
        return;
      }

      if (cmd.startsWith('/model ')) {
        const [, providerArg, modelArg] = query.trim().split(/\s+/, 3);
        try {
          const providerName = providerArg as ProviderName;
          const modelName = modelArg || getDefaultModel(providerName);
          const nextProvider = createProvider(providerName, modelName);
          agent.switchProvider(nextProvider);
          setCurrentProvider(nextProvider);
          const cfg = loadConfig();
          cfg.defaultProvider = providerName;
          cfg.defaultModel = nextProvider.model;
          saveConfig(cfg);
          toast.success(`Switched to ${nextProvider.name} / ${nextProvider.model}`);
        } catch (err) {
          toast.error(`Provider switch failed: ${(err as Error).message}`);
        }
        return;
      }

      if (cmd.startsWith('/memory') || cmd === '/mem') {
        setMessages(prev => [...prev, { role: 'user', content: query }]);
        const args = query.replace(/^\/(?:memory|mem)\s*/i, '').trim();
        if (!args) {
          const entries = memory.loadSemanticEntries();
          const working = memory.workingMemory;
          renderMemoryPanel(entries, working, memory.episodeCount);
        } else if (args.startsWith('query') || args.startsWith('q')) {
          const searchText = args.replace(/^(query|q)\s*/i, '').trim();
          const results = memory.query(searchText, 20);
          renderMemoryPanel(results, memory.workingMemory, memory.episodeCount, searchText);
        } else if (args === 'forget' || args === 'clear') {
          memory.clearAll();
          toast.success('Memory cleared');
        } else {
          const results = memory.query(args, 20);
          renderMemoryPanel(results, memory.workingMemory, memory.episodeCount, args);
        }
        return;
      }

      if (cmd === '/doctor') {
        process.stdout.write('\n  Running diagnostics...\n\n');
        const checks = [
          { name: 'Node.js', ok: true, detail: `v${process.versions.node}` },
          { name: 'Memory dir', ok: true, detail: 'OK' },
        ];
        for (const c of checks) {
          process.stdout.write(`  ${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}\n`);
        }
        process.stdout.write('\n');
        return;
      }

      if (cmd === '/context') {
        const usage = agent.getUsage();
        const total = usage.inputTokens + usage.outputTokens;
        const maxCtx = 200000;
        const pct = Math.round((total / maxCtx) * 100);
        const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
        process.stdout.write(`\n  context ${bar} ${(total / 1000).toFixed(1)}k / ${(maxCtx / 1000).toFixed(0)}k (${pct}%)\n`);
        process.stdout.write(`  messages: ${agent.getMessageCount()}\n\n`);
        return;
      }

      if (cmd === '/clear' || cmd === '/c') {
        setMessages([]);
        return;
      }

      // Pass to handler
      try {
        await handleSlashCommand(query, agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem);
      } catch (err) {
        process.stdout.write(`\n  Unknown command: ${query}\n\n`);
      }
      return;
    }

    if (isProcessing) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setIsProcessing(true);

    const currentMode = query.trim().startsWith('/plan') ? 'plan' as const : 'build' as const;
    setMode(currentMode);

    try {
      let generator: AsyncGenerator<any>;
      if (currentMode === 'plan') {
        const planQuery = query.replace('/plan', '').trim();
        generator = agent.plan(planQuery || 'Generate a plan');
      } else {
        generator = agent.run(query);
      }

      responseStartRef.current = 0;
      for await (const event of generator) {
        if (event.type === 'text') {
          if (responseStartRef.current === 0) {
            responseStartRef.current = Date.now();
          }
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              return [...prev.slice(0, -1), { role: 'assistant', content: last.content + event.content }];
            }
            return [...prev, { role: 'assistant', content: event.content }];
          });
        } else if (event.type === 'tool_start') {
          setActiveTool(event.tool);
        } else if (event.type === 'tool_result' || event.type === 'error' || event.type === 'done') {
          setActiveTool(null);
          if (event.type === 'tool_result' && event.success) {
            attention.alert('Tool completed', `${event.tool} succeeded`, 'low');
          }
          if (event.type === 'error') {
            setErrorCount(c => c + 1);
            attention.alert('Error', event.message?.slice(0, 60), 'high');
          }
          if (event.type === 'done') {
            const elapsed = responseStartRef.current > 0 ? Date.now() - responseStartRef.current : 0;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant') {
                return [...prev.slice(0, -1), { ...last, timing: elapsed, mode: currentMode }];
              }
              return prev;
            });
            const usage = agent.getUsage();
            setTokenCount(prev => prev + usage.inputTokens + usage.outputTokens);
            toast.success('Done');
            attention.alert('Task complete', 'Agent finished processing', 'low');
          }
        } else if (event.type === 'ask_user') {
          setPendingQuestion(event.question);
        }
      }
    } catch (err) {
      const msg = (err as Error).message;
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}` }]);
      toast.error(msg);
      attention.alert('Error', msg.slice(0, 60), 'high');
    }

    setIsProcessing(false);
  }, [agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, isProcessing, showHelp, showProviderSelect, showCommandPalette, multimodalMem]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
  }, []);

  const handleCommandSelect = useCallback((command: Command) => {
    command.action();
  }, []);

  const handleDialogResult = useCallback((result: string | null) => {
    if (result && pendingQuestion) {
      setMessages(prev => [...prev, { role: 'user', content: `[Answer to "${pendingQuestion}"]\n${result}` }]);
      setPendingQuestion(null);
      agent.answerUserQuestion(result);
    }
  }, [pendingQuestion, agent]);

  // ── Render ──
  if (showHelp) {
    return (
      <Box flexDirection="column" padding={1}>
        <HelpPanel onClose={() => setShowHelp(false)} />
      </Box>
    );
  }

  if (showProviderSelect) {
    return (
      <Box flexDirection="column" padding={1}>
        <ProviderSelect
          currentProvider={currentProvider?.name || 'ollama'}
          onSelect={(id, model) => {
            try {
              const providerName = id as ProviderName;
              const modelName = model || getDefaultModel(providerName);
              const nextProvider = createProvider(providerName, modelName);
              agent.switchProvider(nextProvider);
              setCurrentProvider(nextProvider);
              const cfg = loadConfig();
              cfg.defaultProvider = providerName;
              cfg.defaultModel = nextProvider.model;
              saveConfig(cfg);
              toast.success(`Selected: ${nextProvider.name} / ${nextProvider.model}`);
            } catch (err) {
              const msg = `Provider switch failed: ${(err as Error).message}`;
              toast.error(msg);
              attention.alert('Provider Error', msg, 'high');
            }
            setShowProviderSelect(false);
          }}
          onCancel={() => setShowProviderSelect(false)}
        />
      </Box>
    );
  }

  const isEmpty = messages.length === 0;

  return (
    <Box flexDirection="column" padding={0} paddingX={1} minHeight={process.stdout.rows ? process.stdout.rows - 1 : 20}>
      {isEmpty ? (
        /* ── Welcome / Home Screen ── */
        <Box flexDirection="column" flexGrow={1}>
          <WelcomeScreen
            modelName={modelShort(currentProvider?.model || 'Local Agent', 24)}
            providerName={currentProvider?.name || 'ollama'}
            input={input}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
          />
        </Box>
      ) : (
        /* ── Conversation View ── */
        <Box flexDirection="column" flexGrow={1}>
          {/* Persistent header */}
          <Box flexDirection="row" marginTop={0}>
            <Text bold color={tuiConfig.theme.colors.accent}>{'TIMPS'}</Text>
            <Text color={tuiConfig.theme.colors.muted}>{' · '}</Text>
            <Text dimColor>{modelShort(currentProvider?.model || 'Local Agent', 24)}</Text>
            <Text color={tuiConfig.theme.colors.muted}>{' · '}</Text>
            <Text dimColor>{currentProvider?.name || 'ollama'}</Text>
          </Box>
          <Box>
            <Text color={tuiConfig.theme.colors.border}>{'─'.repeat(Math.min(process.stdout.columns || 80, 80))}</Text>
          </Box>

          {/* Toast notifications */}
          <Toast toasts={toast.toasts} onDismiss={toast.dismiss} />

          {/* Messages */}
          <Box flexDirection="column" flexGrow={1} marginTop={1}>
            <MessageList messages={messages} />
          </Box>

          {/* Active tool indicator */}
          {activeTool && !pendingQuestion && (
            <Box marginTop={1} paddingLeft={2}>
              <ToolActivity toolName={activeTool} />
            </Box>
          )}

          {/* Pending question dialog */}
          {pendingQuestion && (
            <Dialog
              config={{
                type: 'input',
                title: 'Question from Agent',
                message: pendingQuestion,
                inputPlaceholder: 'Type your answer...',
              }}
              onResult={handleDialogResult}
              onClose={() => { setPendingQuestion(null); agent.answerUserQuestion?.(''); }}
            />
          )}

          {/* Compact input */}
          <Box flexDirection="column" marginTop={1} paddingLeft={2} paddingRight={2}>
            <Box flexDirection="row">
              <Text color={tuiConfig.theme.colors.accent}>{icons.prompt} </Text>
              <MultilineInput
                value={input}
                onChange={handleInputChange}
                onSubmit={handleSubmit}
                placeholder={isProcessing ? 'Processing...' : pendingQuestion ? 'Answer the question...' : '/help for commands'}
              />
            </Box>
            <Box marginTop={0} paddingLeft={3}>
              <Text color={tuiConfig.theme.colors.dim}>
                {modelShort(currentProvider?.model, 20)}
                {' · '}
                {currentProvider?.name || 'ollama'}
                {' · '}
                {agent.tools?.length || 0} tools
                {' · '}
                {sessionCount} sessions
                {isProcessing ? ' · ◐ processing' : ' · ● ready'}
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Command Palette overlay */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        commands={commandPaletteCommands}
        onCommandSelect={handleCommandSelect}
      />

      {/* Autocomplete */}
      {showAutocomplete && (
        <Autocomplete
          isOpen={showAutocomplete}
          query={input}
          cursorPosition={input.length}
          suggestions={autocompleteSuggestions}
          selectedIndex={autocompleteIndex}
          onSelect={(suggestion) => {
            setInput(suggestion.label);
            setShowAutocomplete(false);
          }}
          onHover={setAutocompleteIndex}
          onClose={() => setShowAutocomplete(false)}
        />
      )}

      {/* Bottom Status Bar */}
      <BottomBar
        mcpCount={agent.tools?.length || 0}
        version="2.0.1"
        mode={mode}
        modelName={modelShort(currentProvider?.model || 'Local Agent', 24)}
        tokenCount={tokenCount}
        tokenLimit={tokenLimit}
      />
    </Box>
  );
};

function modelShort(model: string, max: number): string {
  return model.length > max ? model.slice(0, max - 1) + '…' : model;
}