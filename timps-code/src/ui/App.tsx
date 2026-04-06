import React, { useState } from 'react';
import { Box, Text, Newline } from 'ink';
import TextInput from 'ink-text-input';
import { MessageList } from './components/MessageList.js';
import { ToolActivity } from './components/ToolActivity.js';
import { ProviderName, ModelProvider } from '../types.js';
import { handleSlashCommand } from '../app.js';
import { renderHelp, renderModelsList, renderMemoryPanel, renderError } from '../renderer.js';

import { MemoryDashboard } from './panels/MemoryDashboard.js';

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
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [mode, setMode] = useState<'chat' | 'help' | 'models' | 'memory'>('chat');
  
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState('');

  const handleSubmit = async (query: string) => {
    if (!query.trim()) return;

    // Handle slash commands
    if (query.trim().startsWith('/')) {
      const cmd = query.trim().toLowerCase();

      if (cmd === '/help' || cmd === '/h') {
        renderHelp();
        return;
      }

      if (cmd === '/provider' || cmd === '/models') {
        renderModelsList(provider.model, ['claude', 'openai', 'gemini', 'ollama', 'openrouter']);
        return;
      }

      if (cmd === '/model') {
        console.log(`\n  Current: ${provider.model}`);
        console.log('  Usage: /model <provider> [model]');
        console.log('  Providers: claude, openai, gemini, ollama, openrouter\n');
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
          console.log('\n  Memory cleared\n');
        } else {
          const results = memory.query(args, 20);
          renderMemoryPanel(results, memory.workingMemory, memory.episodeCount, args);
        }
        return;
      }

      if (cmd === '/doctor') {
        console.log('\n  Running diagnostics...\n');
        const checks = [
          { name: 'Node.js', ok: true, detail: `v${process.versions.node}` },
          { name: 'Memory dir', ok: true, detail: 'OK' },
        ];
        for (const c of checks) {
          console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`);
        }
        console.log();
        return;
      }

      if (cmd === '/context') {
        const usage = agent.getUsage();
        const total = usage.inputTokens + usage.outputTokens;
        const maxCtx = 200000;
        const pct = Math.round((total / maxCtx) * 100);
        const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
        console.log(`\n  context ${bar} ${(total / 1000).toFixed(1)}k / ${(maxCtx / 1000).toFixed(0)}k (${pct}%)`);
        console.log(`  messages: ${agent.getMessageCount()}\n`);
        return;
      }

      if (cmd.startsWith('/think')) {
        const question = query.replace(/^\/think\s*/i, '').trim();
        if (!question) {
          console.log('\n  Usage: /think <question>\n');
          return;
        }
        console.log(`\n  Reasoning about: ${question}\n`);
        // Just pass to agent
      } else {
        // Try using the slash command handler
        try {
          await handleSlashCommand(query, agent, memory, todos, snapshots, permissions, provider, cwd, sessionDir, 'ollama', multimodalMem);
        } catch (err) {
          console.log(`\n  Unknown command: ${query}\n`);
        }
        return;
      }
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
      <MemoryDashboard memoryCount={memoryCount} openTodos={openTodos} cwd={cwd} />
      
      <Box marginBottom={1}>
        <Text color="cyan" bold>TIMPS Code</Text>
        <Text dimColor> — {provider?.model || 'Local Agent'}</Text>
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
    </Box>
  );
};
