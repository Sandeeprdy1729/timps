import React, { useState } from 'react';
import { Box, Text, Newline, useInput } from 'ink';

interface ProviderOption {
  id: string;
  name: string;
  description: string;
  models: string[];
  local: boolean;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'claude',
    name: 'Claude',
    description: "Anthropic's Claude — best for complex reasoning and long context",
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'],
    local: false,
  },
  {
    id: 'openai',
    name: 'OpenAI / GPT',
    description: 'GPT and reasoning models via OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
    local: false,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Many hosted open and closed models via OPENROUTER_API_KEY',
    models: ['google/gemini-2.0-flash-exp:free', 'anthropic/claude-sonnet-4-20250514', 'meta-llama/llama-3.1-405b-instruct'],
    local: false,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Google Gemini models via GEMINI_API_KEY',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    local: false,
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open source coding agent — privacy first, fully local',
    models: ['qwen2.5-coder:latest', 'deepseek-r1:7b', 'codellama:7b'],
    local: true,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Run open models locally — qwen, deepseek, codellama and more',
    models: ['qwen2.5-coder:7b', 'deepseek-r1:7b', 'codellama:7b', 'gemma3:1b'],
    local: true,
  },
  {
    id: 'timps-coder',
    name: 'TIMPs Coder',
    description: 'Your custom local TIMPs coding model through Ollama',
    models: ['sandeeprdy1729/timps-coder', 'sandeeprdy1729/timps-coder:latest'],
    local: true,
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    description: 'Local fast model plus Claude/OpenAI for heavy reasoning',
    models: ['auto'],
    local: true,
  },
];

interface ProviderSelectProps {
  currentProvider: string;
  onSelect: (providerId: string, model?: string) => void;
  onCancel: () => void;
}

export const ProviderSelect: React.FC<ProviderSelectProps> = ({
  currentProvider,
  onSelect,
  onCancel,
}) => {
  const [selected, setSelected] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelected((value) => (value - 1 + PROVIDERS.length) % PROVIDERS.length);
      return;
    }
    if (key.downArrow) {
      setSelected((value) => (value + 1) % PROVIDERS.length);
      return;
    }
    if (key.return) {
      const provider = PROVIDERS[selected];
      onSelect(provider.id, provider.models[0]);
      return;
    }
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box borderStyle="single" borderColor="#4A8C7A" flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="#4A8C7A">Select AI Provider</Text>
        <Newline />
        {PROVIDERS.map((provider, i) => {
          const isSelected = i === selected;
          const isCurrent  = provider.id === currentProvider;
          return (
            <Box key={provider.id} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color={isSelected ? '#7EC8B8' : '#4A8C7A'} bold>
                  {isSelected ? '❯ ' : '  '}
                </Text>
                <Text bold={isSelected} color={isSelected ? '#F5F0E1' : undefined}>
                  {provider.name}
                </Text>
                {provider.local && <Text dimColor>  local</Text>}
                {isCurrent    && <Text color="#C8B94F">  ✔ active</Text>}
              </Box>
              <Box paddingLeft={4}>
                <Text dimColor>{provider.description}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
      <Newline />
      <Text dimColor>  ↑↓ navigate  ↵ select  Esc cancel</Text>
    </Box>
  );
};

export const PROVIDER_LIST = PROVIDERS;

export const getProviderModels = (providerId: string): string[] => {
  const provider = PROVIDERS.find(p => p.id === providerId);
  return provider?.models || [];
};
