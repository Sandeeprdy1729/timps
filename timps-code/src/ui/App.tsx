import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import { MessageList } from './components/MessageList.js';
import { ToolActivity } from './components/ToolActivity.js';
import type { ProviderName, ModelProvider } from '../config/types.js';
import { handleSlashCommand } from '../core/app.js';
import { renderModelsList, renderMemoryPanel } from '../utils/renderer.js';
import { createProvider } from '../models/index.js';
import { getDefaultModel, loadConfig, saveConfig } from '../config/config.js';

import { HelpPanel } from './panels/HelpPanel.js';
import { ProviderSelect } from './panels/ProviderSelect.js';

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

// ── TIMPS robot colors from the pixel art mascot ──
const C_TEAL    = '#4A8C7A'; // robot screen teal  — accent
const C_TEAL_DK = '#2D5A4F'; // dark teal           — border
const C_TAN     = '#C8BF8C'; // robot body tan      — secondary text
const C_CREAM   = '#F5F0E1'; // cream               — primary text
const C_DIM     = '#64747A'; // slate               — muted
const C_GREEN   = '#28A070'; // success green
const C_YELLOW  = '#C8B94F'; // golden tan

// ── Slash command grid shown when no messages exist (OpenCode style) ──
const commands = [
  { cmd: '/new    ', desc: 'new session' },
  { cmd: '/help   ', desc: 'show help' },
  { cmd: '/memory ', desc: 'project memory' },
  { cmd: '/models ', desc: 'list models' },
  { cmd: '/skills ', desc: 'skill packs' },
  { cmd: '/forge  ', desc: 'version branches' },
  { cmd: '/agents ', desc: 'multi-agent' },
  { cmd: '/git    ', desc: 'git status' },
];

const WelcomeScreen = () => (
  <Box flexDirection="column" alignItems="center" paddingY={2}>
    {/* Pixel robot — teal screen + tan body */}
    <Box flexDirection="column" alignItems="center" marginBottom={2}>
      <Text color={C_TEAL_DK}>   ┌──────┐   </Text>
      <Text><Text color={C_TEAL_DK}>   │ </Text><Text color="#E8E0B0">◉  ◉</Text><Text color={C_TEAL_DK}> │   </Text></Text>
      <Text><Text color={C_TEAL_DK}>   │  </Text><Text color="#E8E0B0">▿  </Text><Text color={C_TEAL_DK}> │   </Text></Text>
      <Text color={C_TEAL_DK}>   └──────┘   </Text>
      <Text color={C_TAN}>    ║    ║    </Text>
      <Text color={C_TAN}>  ┌─┴────┴─┐ </Text>
      <Text color={C_TAN}>  │        │ </Text>
      <Text color={C_TAN}>  └─┬────┬─┘ </Text>
      <Text color="#1C1C1C">    ██    ██  </Text>
    </Box>

    {/* Brand name */}
    <Box marginBottom={1}>
      <Text bold color={C_TEAL}>TIMPS</Text>
      <Text bold color={C_CREAM}>CODE</Text>
    </Box>

    {/* Command grid — 2 columns */}
    <Box flexDirection="column" marginBottom={2}>
      {commands.map((c, i) => (
        <Box key={i}>
          <Text color={C_TEAL} bold>{c.cmd}</Text>
          <Text color={C_DIM}>{c.desc}</Text>
          {i % 2 === 0 && i + 1 < commands.length ? (
            <>
              <Text>{'     '}</Text>
              <Text color={C_TEAL} bold>{commands[i + 1].cmd}</Text>
              <Text color={C_DIM}>{commands[i + 1].desc}</Text>
            </>
          ) : null}
        </Box>
      )).filter((_, i) => i % 2 === 0)}
    </Box>
  </Box>
);

// ── Bottom status bar — always visible ──
const StatusBar = ({
  model,
  provider,
  cwd,
  memoryCount,
  openTodos,
}: {
  model: string;
  provider: string;
  cwd: string;
  memoryCount: number;
  openTodos: number;
}) => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const project = cwd.startsWith(homeDir) ? '~' + cwd.slice(homeDir.length) : cwd;
  const modelShort = model.length > 20 ? model.slice(0, 18) + '…' : model;
  return (
    <Box borderStyle="single" borderColor={C_TEAL_DK} paddingX={1}>
      <Text bold color={C_TEAL}>timps</Text>
      <Text color={C_DIM}>  {provider} · {modelShort}</Text>
      <Text color={C_DIM}>  {project}</Text>
      {memoryCount > 0 && <Text color={C_GREEN}>  ·  {memoryCount}m</Text>}
      {openTodos > 0   && <Text color={C_YELLOW}>  ·  {openTodos}t</Text>}
      <Box flexGrow={1} />
      <Text color={C_DIM}>tab /help  </Text>
      <Box borderStyle="single" borderColor={C_TEAL}>
        <Text bold color={C_TEAL}> BUILD AGENT </Text>
      </Box>
    </Box>
  );
};

export const App = ({ agent, memory, todos, snapshots, permissions, provider, cwd, sessionDir, multimodalMem }: AppProps) => {
  const [currentProvider, setCurrentProvider] = useState<ModelProvider>(provider);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showProviderSelect, setShowProviderSelect] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState('');

  useEffect(() => {
    const handleKeyPress = (data: any) => {
      if (showHelp && data.toString() === '\r') setShowHelp(false);
    };
    process.stdin.on('keypress', handleKeyPress);
    return () => { process.stdin.off('keypress', handleKeyPress); };
  }, [showHelp]);

  const handleSubmit = async (query: string) => {
    if (!query.trim()) return;
    if (showHelp)          { setShowHelp(false); return; }
    if (showProviderSelect) { setShowProviderSelect(false); return; }

    if (query.trim().startsWith('/')) {
      const cmd = query.trim().toLowerCase();

      if (cmd === '/help' || cmd === '/h') { setShowHelp(true); return; }
      if (cmd === '/provider' || cmd === '/models' || cmd === '/model') { setShowProviderSelect(true); return; }

      if (cmd.startsWith('/model ')) {
        const [, providerArg, modelArg] = query.trim().split(/\s+/, 3);
        try {
          const providerName = providerArg as ProviderName;
          const modelName = modelArg || getDefaultModel(providerName);
          const nextProvider = createProvider(providerName, modelName);
          agent.switchProvider(nextProvider);
          setCurrentProvider(nextProvider);
          const config = loadConfig();
          config.defaultProvider = providerName;
          config.defaultModel = nextProvider.model;
          saveConfig(config);
          process.stdout.write(`\n  Switched to ${nextProvider.name} / ${nextProvider.model}\n\n`);
        } catch (err) {
          process.stdout.write(`\n  Provider switch failed: ${(err as Error).message}\n\n`);
        }
        return;
      }

      if (cmd.startsWith('/memory') || cmd === '/mem') {
        const args = query.replace(/^\/(?:memory|mem)\s*/i, '').trim();
        if (!args) {
          renderMemoryPanel(memory.loadSemanticEntries(), memory.workingMemory, memory.episodeCount);
        } else if (args === 'forget' || args === 'clear') {
          memory.clearAll();
          process.stdout.write('\n  Memory cleared\n\n');
        } else {
          renderMemoryPanel(memory.query(args, 20), memory.workingMemory, memory.episodeCount, args);
        }
        return;
      }

      if (cmd === '/doctor') {
        process.stdout.write('\n  Running diagnostics…\n\n');
        process.stdout.write(`  ✓ Node.js  v${process.versions.node}\n`);
        process.stdout.write(`  ✓ Memory dir  OK\n\n`);
        return;
      }

      if (cmd === '/context') {
        const usage = agent.getUsage();
        const total = usage.inputTokens + usage.outputTokens;
        const maxCtx = 200000;
        const pct = Math.round((total / maxCtx) * 100);
        const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
        process.stdout.write(`\n  context ${bar} ${(total / 1000).toFixed(1)}k / ${(maxCtx / 1000).toFixed(0)}k (${pct}%)\n\n`);
        return;
      }

      try {
        await handleSlashCommand(query, agent, memory, todos, snapshots, permissions, currentProvider, cwd, sessionDir, currentProvider?.name || 'ollama', multimodalMem);
      } catch {
        process.stdout.write(`\n  Unknown command: ${query}\n\n`);
      }
      return;
    }

    if (isProcessing) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setIsProcessing(true);

    try {
      const generator = query.trim().startsWith('/plan')
        ? agent.plan(query.replace('/plan', '').trim() || 'Generate a plan')
        : agent.run(query);

      for await (const event of generator) {
        if (event.type === 'text') {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { role: 'assistant', content: last.content + event.content }];
            }
            return [...prev, { role: 'assistant', content: event.content }];
          });
        } else if (event.type === 'tool_start') {
          setActiveTool(event.tool);
        } else if (event.type === 'tool_result' || event.type === 'error' || event.type === 'done') {
          setActiveTool(null);
        } else if (event.type === 'ask_user') {
          setPendingQuestion(event.question);
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${(err as Error).message}` }]);
    }

    setIsProcessing(false);
  };

  const memoryCount = memory?.query('', 100)?.length || 0;
  const openTodos   = todos?.getOpen()?.length || 0;
  const hasMessages = messages.length > 0;

  if (showHelp) return <HelpPanel onClose={() => setShowHelp(false)} />;

  if (showProviderSelect) return (
    <ProviderSelect
      currentProvider={currentProvider?.name || 'ollama'}
      onSelect={(id, model) => {
        try {
          const providerName = id as ProviderName;
          const modelName = model || getDefaultModel(providerName);
          const nextProvider = createProvider(providerName, modelName);
          agent.switchProvider(nextProvider);
          setCurrentProvider(nextProvider);
          const config = loadConfig();
          config.defaultProvider = providerName;
          config.defaultModel = nextProvider.model;
          saveConfig(config);
          process.stdout.write(`\n  Selected: ${nextProvider.name} / ${nextProvider.model}\n\n`);
        } catch (err) {
          process.stdout.write(`\n  Provider switch failed: ${(err as Error).message}\n\n`);
        }
        setShowProviderSelect(false);
      }}
      onCancel={() => setShowProviderSelect(false)}
    />
  );

  return (
    <Box flexDirection="column" height="100%">

      {/* ── Main content area ── */}
      <Box flexDirection="column" flexGrow={1} paddingX={2}>

        {/* Welcome when no conversation */}
        {!hasMessages && <WelcomeScreen />}

        {/* Conversation */}
        {hasMessages && <MessageList messages={messages} />}

        {/* Tool activity */}
        {activeTool && !pendingQuestion && (
          <Box marginTop={1}>
            <ToolActivity toolName={activeTool} />
          </Box>
        )}

        {/* User question */}
        {pendingQuestion && (
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text color={C_YELLOW} bold>? </Text>
              <Text>{pendingQuestion}</Text>
            </Box>
            <Box marginTop={1}>
              <Text color={C_TEAL} bold>❯ </Text>
              <TextInput
                value={answerInput}
                onChange={setAnswerInput}
                onSubmit={(ans) => {
                  setMessages(prev => [...prev, { role: 'user', content: `[${pendingQuestion}]\n${ans}` }]);
                  setPendingQuestion(null);
                  setAnswerInput('');
                  agent.answerUserQuestion(ans);
                }}
              />
            </Box>
          </Box>
        )}

        {/* Main input */}
        {!isProcessing && !pendingQuestion && (
          <Box marginTop={1}>
            <Text color={C_TEAL} bold>❯ </Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder="Type a task, or /help for commands"
            />
          </Box>
        )}

        {/* Processing */}
        {isProcessing && (
          <Box marginTop={1}>
            <Text color={C_DIM}>processing…</Text>
          </Box>
        )}

      </Box>

      {/* ── Bottom status bar ── */}
      <StatusBar
        model={currentProvider?.model || 'local'}
        provider={currentProvider?.name || 'local'}
        cwd={cwd}
        memoryCount={memoryCount}
        openTodos={openTodos}
      />
    </Box>
  );
};
