import React, { useState } from 'react';
import { Box, Text, Newline } from 'ink';

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
    name: 'Claude Code',
    description: 'Anthropic\'s Claude — best for complex reasoning and long context',
    models: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
    local: false,
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI\'s coding model — excellent for code generation',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
    local: false,
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open source coding agent — privacy first, fully local',
    models: ['opencode/default'],
    local: true,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Run open models locally — qwen, deepseek, codellama and more',
    models: ['qwen2.5-coder:7b', 'deepseek-r1:7b', 'codellama:7b', 'gemma3:1b'],
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

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" padding={1}>
        <Text bold color="cyan">Select AI Provider</Text>
        <Newline />
        {PROVIDERS.map((provider, i) => (
          <Box key={provider.id} flexDirection="column">
            <Box>
              <Text dimColor>[ </Text>
              <Text color={i === selected ? 'green' : undefined}>
                {i === selected ? '●' : ' '}
              </Text>
              <Text dimColor>]</Text>
              <Text bold={i === selected} color={i === selected ? 'white' : undefined}>
                {' '}{provider.name}
              </Text>
              {provider.local && (
                <Text dimColor> (local)</Text>
              )}
              {provider.id === currentProvider && (
                <Text dimColor> current</Text>
              )}
            </Box>
            <Box paddingLeft={4} flexDirection="column">
              <Text dimColor>{provider.description}</Text>
            </Box>
            <Newline />
          </Box>
        ))}
      </Box>
      <Newline />
      <Text dimColor>↑↓ navigate  ↵ select  Esc cancel</Text>
    </Box>
  );
};

export const PROVIDER_LIST = PROVIDERS;

export const getProviderModels = (providerId: string): string[] => {
  const provider = PROVIDERS.find(p => p.id === providerId);
  return provider?.models || [];
};
