import React from 'react';
import { Box, Text } from 'ink';
import { loadTUIConfig } from '../../config/tui/index.js';

export interface BottomBarProps {
  mcpCount: number;
  version: string;
  mode: 'build' | 'plan';
  modelName: string;
  tokenCount: number;
  tokenLimit: number;
}

const config = loadTUIConfig();

export const BottomBar = ({ mcpCount, version, mode, modelName, tokenCount, tokenLimit }: BottomBarProps) => {
  const tokenPct = tokenLimit > 0 ? Math.round((tokenCount / tokenLimit) * 100) : 0;
  const tokenStr = tokenCount > 0 ? `${(tokenCount / 1000).toFixed(1)}K (${tokenPct}%)` : '';

  return (
    <Box borderStyle="single" borderColor={config.theme.colors.border} paddingX={1} marginTop={1}>
      <Box flexGrow={1}>
        <Text color={config.theme.colors.dim}>
          <Text bold color={mode === 'plan' ? config.theme.colors.warning : config.theme.colors.accent}>
            {mode === 'plan' ? 'Plan' : 'Build'}
          </Text>
          {' · '}{modelName}
        </Text>
      </Box>
      <Box>
        <Text color={config.theme.colors.dim}>
          ~ {mcpCount} MCP <Text color={config.theme.colors.muted}>/status</Text>
        </Text>
      </Box>
      {tokenStr && (
        <Box marginLeft={2}>
          <Text color={config.theme.colors.muted}>{tokenStr}</Text>
        </Box>
      )}
      <Box marginLeft={2}>
        <Text color={config.theme.colors.muted}>v{version}</Text>
      </Box>
    </Box>
  );
};
