import React from 'react';
import { Box, Text } from 'ink';
import { t, icons } from '../../config/theme.js';
import { loadTUIConfig, TUIConfig } from '../../config/tui/index.js';

const config: TUIConfig = loadTUIConfig();

export interface FooterProps {
  hasPendingQuestion: boolean;
  isProcessing: boolean;
  model: string;
  provider: string;
  toolCount: number;
  sessionCount: number;
}

export const Footer = ({ hasPendingQuestion, isProcessing, model, provider, toolCount, sessionCount }: FooterProps) => {
  const termWidth = process.stdout.columns || 80;
  const maxWidth = config.layout.sizing.maxWidth || 120;
  const width = Math.min(termWidth - 2, maxWidth);
  const innerWidth = width - 2;

  const dim = t.hex(config.theme.colors.dim);
  const accent = t.hex(config.theme.colors.accent);
  const muted = t.hex(config.theme.colors.muted);
  const border = t.hex(config.theme.colors.border);

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Keybind hints */}
      <Box paddingLeft={2} paddingRight={2}>
        <Text>
          {accent(icons.prompt)}{' '}
          {dim('tab')} {muted('autocomplete ·')}{' '}
          {dim('ctrl+p')} {muted('commands ·')}{' '}
          {dim('?')} {muted('help ·')}{' '}
          {dim('ctrl+x')} {muted('leader')}
        </Text>
      </Box>

      {/* Bottom border row with model badge */}
      <Box paddingLeft={2} paddingRight={2} marginTop={0}>
        <Text>
          {border('╰')}{border('─')}{' '}
          {accent(model.slice(0, 18))}{' '}
          {dim(`(${provider})`)}
          {'  '}
          {muted(`${toolCount} tools · ${sessionCount} sessions`)}
          {'  '}
          {isProcessing ? accent('◐ processing') : dim('ready')}
          {'  '}
          {dim(new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }))}
          {' '}{border('─'.repeat(Math.max(2, innerWidth - 40 - model.length - provider.length - toolCount.toString().length - sessionCount.toString().length - config.theme.colors.dim.length)))} {border('╯')}
        </Text>
      </Box>
    </Box>
  );
};