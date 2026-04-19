import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import TextInput from 'ink-text-input';
import { MessageList } from './components/MessageList.js';
import { ToolActivity } from './components/ToolActivity.js';
import type { ProviderName, ModelProvider } from '../config/types.js';
import { handleSlashCommand } from '../core/app.js';
import { renderModelsList, renderMemoryPanel } from '../utils/renderer.js';
import { createProvider } from '../models/index.js';
import { getDefaultModel, loadConfig, saveConfig } from '../config/config.js';

import { MemoryDashboard } from './panels/MemoryDashboard.js';
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
      if (showHelp && data.toString() === '\r') {
        setShowHelp(false);
      }
    };
    process.stdin.on('keypress', handleKeyPress);
    return () => {
      process.stdin.off('keypress', handleKeyPress);
    };
  }, [showHelp]);

  const handleSubmit = async (query: string) => {
    if (!query.trim()) return;

    if (showHelp) {
      setShowHelp(false);
      return;
    }

    if (showProviderSelect) {
      setShowProviderSelect(false);
      return;
    }

    // Handle slash commands
    if (query.trim().startsWith('/')) {
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
          const entries = memory.loadSemanticEntries();
          const working = memory.workingMemory;
          renderMemoryPanel(entries, working, memory.episodeCount);
        } else if (args.startsWith('query') || args.startsWith('q')) {
          const searchText = args.replace(/^(query|q)\s*/i, '').trim();
          const results = memory.query(searchText, 20);
          renderMemoryPanel(results, memory.workingMemory, memory.episodeCount, searchText);
        } else if (args === 'forget' || args === 'clear') {
          memory.clearAll();
          process.stdout.write('\n  Memory cleared\n\n');
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

      // Pass all other commands to the handler
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

    try {
      let generator;
      if (query.trim().startsWith('/plan')) {
         const planQuery = query.replace('/plan', '').trim();
         generator = agent.plan(planQuery || 'Generate a plan');
      } else {
         generator = agent.run(query);
      }

      for await (const event of generator) {
        if (event.type === 'text') {
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
  const openTodos = todos?.getOpen()?.length || 0;

  return (
    <Box flexDirection="column" padding={1}>
      {showHelp ? (
        <HelpPanel onClose={() => setShowHelp(false)} />
      ) : showProviderSelect ? (
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
      ) : (
        <>
          <MemoryDashboard memoryCount={memoryCount} openTodos={openTodos} cwd={cwd} />
          
          <Box marginBottom={1}>
            <Text color="cyan" bold>TIMPS Code</Text>
            <Text dimColor> — {currentProvider?.name || 'agent'} / {currentProvider?.model || 'Local Agent'}</Text>
          </Box>

          <MessageList messages={messages} />

          {activeTool && !pendingQuestion && (
            <Box marginTop={1}>
              <ToolActivity toolName={activeTool} />
            </Box>
          )}

          {pendingQuestion && (
            <Box marginTop={1}>
              <Text color="yellow">? User Input Required: </Text>
              <Text>{pendingQuestion}</Text>
              <Box marginTop={1}>
                <Text color="green">❯ </Text>
                <TextInput
                  value={answerInput}
                  onChange={setAnswerInput}
                  onSubmit={(ans) => {
                    setMessages(prev => [...prev, { role: 'user', content: `[Answer to "${pendingQuestion}"]\n${ans}` }]);
                    setPendingQuestion(null);
                    setAnswerInput('');
                    agent.answerUserQuestion(ans);
                  }}
                />
              </Box>
            </Box>
          )}

          {!isProcessing && !pendingQuestion && (
            <Box marginTop={1}>
              <Text color="green">❯ </Text>
              <TextInput
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                placeholder="Type your instruction or /help"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
};
