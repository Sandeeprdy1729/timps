import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { t, icons } from '../../config/theme.js';
import { loadTUIConfig, TUIConfig } from '../../config/tui/index.js';

export interface StatusBarProps {
  model: string;
  provider: string;
  contextUsed: number;
  contextMax: number;
  toolCount?: number;
  sessionCount?: number;
  memoryCount?: number;
  gitBranch?: string;
  isProcessing?: boolean;
  errorCount?: number;
}

const config: TUIConfig = loadTUIConfig();

export const StatusBar = ({
  model,
  provider,
  contextUsed,
  contextMax,
  toolCount = 0,
  sessionCount = 0,
  memoryCount = 0,
  gitBranch,
  isProcessing = false,
  errorCount = 0,
}: StatusBarProps) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  if (!config.layout.visibility.showStatusBar) return null;

  const ctxPct = Math.min(100, Math.round((contextUsed / Math.max(contextMax, 1)) * 100));
  const ctxColor = ctxPct > 80 ? config.theme.colors.error : ctxPct > 60 ? config.theme.colors.warning : config.theme.colors.success;
  const filled = Math.min(12, Math.round((contextUsed / Math.max(contextMax, 1)) * 12));
  const ctxBarStr = '█'.repeat(filled) + '░'.repeat(12 - filled);

  const modelShort = model.length > 16 ? model.slice(0, 14) + '…' : model;

  const errSection = errorCount > 0 ? (
    <Text color={config.theme.colors.error}> ✘{errorCount}</Text>
  ) : null;

  return (
    <Box borderStyle="round" borderColor={config.theme.colors.border} paddingX={1} minWidth={40}>
      <Text>
        <Text color={config.theme.colors.accent}>{icons.prompt} {modelShort}</Text>
        <Text color={config.theme.colors.dim}> ctx </Text>
        <Text color={ctxColor}>{ctxBarStr}</Text>
        <Text color={config.theme.colors.muted}> {ctxPct}%</Text>
        <Text color={config.theme.colors.dim}>  {toolCount}t</Text>
        {sessionCount > 0 && <Text color={config.theme.colors.dim}> · {sessionCount}s</Text>}
        {memoryCount > 0 && <Text color={config.theme.colors.dim}> · {memoryCount}m</Text>}
        {gitBranch && <Text color={config.theme.colors.dim}>  git:</Text>}
        {gitBranch && <Text color={config.theme.colors.info}>{gitBranch}</Text>}
        {errSection}
        <Text>  </Text>
        <Text color={isProcessing ? config.theme.colors.accent : config.theme.colors.success}>
          {isProcessing ? '•' : '●'}
        </Text>
        <Text color={config.theme.colors.muted}> {time}</Text>
      </Text>
    </Box>
  );
};