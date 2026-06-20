import React from 'react';
import { Box, Text } from 'ink';
import { LOGO_TIMPS, icons } from '../../config/theme.js';
import { loadTUIConfig } from '../../config/tui/index.js';
import { MultilineInput } from './MultilineInput.js';

export interface WelcomeScreenProps {
  modelName: string;
  providerName: string;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

const config = loadTUIConfig();
const termWidth = process.stdout.columns || 80;
const inputWidth = Math.min(termWidth - 6, 68);

export const WelcomeScreen = ({ modelName, providerName, input, onInputChange, onSubmit }: WelcomeScreenProps) => {
  return (
    <Box flexDirection="column" alignItems="center" paddingTop={3}>
      {/* Logo */}
      <Text>{LOGO_TIMPS}</Text>

      {/* Input bar with left accent border */}
      <Box flexDirection="row" marginTop={2} width={inputWidth}>
        <Box width={3} backgroundColor="#A78BFA" />
        <Box flexGrow={1} backgroundColor="#2a2a2a">
          <Box paddingLeft={2} paddingRight={1}>
            <MultilineInput
              value={input}
              onChange={onInputChange}
              onSubmit={onSubmit}
              placeholder="Ask anything... 'What is the tech stack of this project?'"
            />
          </Box>
        </Box>
      </Box>

      {/* Model name + keybind hints */}
      <Box flexDirection="row" width={inputWidth} marginTop={1}>
        <Box>
          <Text color={config.theme.colors.accent}>{modelName}</Text>
        </Box>
        <Box flexGrow={1} />
        <Box>
          <Text color={config.theme.colors.muted}>
            tab agents
          </Text>
          <Text color={config.theme.colors.border}>  ·  </Text>
          <Text color={config.theme.colors.muted}>
            ctrl+p commands
          </Text>
        </Box>
      </Box>

      {/* Tips */}
      <Box flexDirection="column" marginTop={2} alignItems="center">
        <Box flexDirection="row">
          <Text color={config.theme.colors.warning}>{icons.warning} </Text>
          <Text color={config.theme.colors.dim}>
            Use <Text bold color={config.theme.colors.accent}>/undo</Text> to revert the last message and file changes
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={config.theme.colors.muted}>
            Show keyboard shortcuts with ctrl+alt+k
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
