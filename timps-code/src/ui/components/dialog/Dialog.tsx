import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { t, icons, box } from '../../../config/theme.js';
import { loadTUIConfig } from '../../../config/tui/index.js';

type DialogType = 'alert' | 'confirm' | 'select' | 'input' | 'progress';

export interface DialogOption {
  label: string;
  value: string;
  description?: string;
  shortcut?: string;
}

export interface DialogConfig {
  type: DialogType;
  title: string;
  message: string;
  detail?: string;
  options?: DialogOption[];
  inputPlaceholder?: string;
  inputDefault?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  progress?: number;
  progressMessage?: string;
}

export interface DialogProps {
  config: DialogConfig | null;
  onResult: (result: string | null) => void;
  onClose: () => void;
}

const termWidth = process.stdout.columns || 80;
const config = loadTUIConfig();
const dialogWidth = Math.min(termWidth - 4, config.layout.sizing.dialogMaxWidth || 70);
const innerWidth = dialogWidth - 4;

const DialogIcon: Record<DialogType, string> = {
  alert: '⚠',
  confirm: '?',
  select: '⌘',
  input: '✎',
  progress: '◐',
};

export const Dialog = ({ config: dialogConfig, onResult, onClose }: DialogProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputValue, setInputValue] = useState(dialogConfig?.inputDefault || '');


  useEffect(() => {
    if (dialogConfig) {
      setSelectedIndex(0);
      setInputValue(dialogConfig.inputDefault || '');
    }
  }, [dialogConfig]);

  const handleKeyDown = useCallback((key: { name?: string; ctrl?: boolean; shift?: boolean }) => {
    if (!dialogConfig) return;
    switch (key.name) {
      case 'escape':
        if (dialogConfig.type === 'alert') { onResult('ok'); }
        else { onResult(null); }
        onClose();
        break;
      case 'return':
        if (dialogConfig.type === 'confirm') { onResult('yes'); onClose(); }
        else if (dialogConfig.type === 'input') { onResult(inputValue); onClose(); }
        else if (dialogConfig.type === 'select' && dialogConfig.options?.length) { onResult(dialogConfig.options[selectedIndex].value); onClose(); }
        else if (dialogConfig.type === 'alert') { onResult('ok'); onClose(); }
        break;
      case 'up':
        if (dialogConfig.type === 'select' && dialogConfig.options?.length) {
          setSelectedIndex(i => Math.max(0, i - 1));
        }
        break;
      case 'down':
        if (dialogConfig.type === 'select' && dialogConfig.options?.length) {
          setSelectedIndex(i => Math.min(dialogConfig.options!.length - 1, i + 1));
        }
        break;
    }
  }, [dialogConfig, selectedIndex, inputValue, onResult, onClose]);

  if (!dialogConfig) return null;

  const borderColor = config.theme.colors.borderFocus;

  const renderContent = () => {
    switch (dialogConfig.type) {
      case 'alert':
        return (
          <>
            <Text>{dialogConfig.message}</Text>
            {dialogConfig.detail && (
              <Box marginTop={1}>
                <Text color={config.theme.colors.muted}>{dialogConfig.detail}</Text>
              </Box>
            )}
            <Box marginTop={1} justifyContent="center">
              <Box paddingX={2} paddingY={0} borderStyle="round" borderColor={config.theme.colors.accent}>
                <Text color={config.theme.colors.accent}>OK (Enter)</Text>
              </Box>
            </Box>
          </>
        );

      case 'confirm':
        return (
          <>
            <Text>{dialogConfig.message}</Text>
            {dialogConfig.detail && (
              <Box marginTop={1}>
                <Text color={config.theme.colors.muted}>{dialogConfig.detail}</Text>
              </Box>
            )}
            <Box marginTop={1} flexDirection="row" gap={2} justifyContent="center">
              <Box paddingX={2} paddingY={0} borderStyle="round" borderColor={config.theme.colors.accent}>
                <Text color={config.theme.colors.accent}>{dialogConfig.confirmLabel || 'Yes (Enter)'}</Text>
              </Box>
              <Box paddingX={2} paddingY={0} borderStyle="round" borderColor={config.theme.colors.border}>
                <Text color={config.theme.colors.muted}>{dialogConfig.cancelLabel || 'No (Esc)'}</Text>
              </Box>
            </Box>
          </>
        );

      case 'select':
        return (
          <>
            <Text>{dialogConfig.message}</Text>
            {dialogConfig.detail && (
              <Box marginTop={1}>
                <Text color={config.theme.colors.muted}>{dialogConfig.detail}</Text>
              </Box>
            )}
            <Box flexDirection="column" marginTop={1}>
              {dialogConfig.options?.map((option, index) => (
                <Box
                  key={option.value}
                  flexDirection="row"
                  backgroundColor={index === selectedIndex ? config.theme.colors.selection : undefined}
                >
                  <Text color={index === selectedIndex ? config.theme.colors.accentBold : config.theme.colors.muted}>
                    {index === selectedIndex ? '▸' : ' '}
                  </Text>
                  <Box marginLeft={1}>
                    <Text bold={index === selectedIndex}>{option.label}</Text>
                  </Box>
                  {option.description && (
                    <Box marginLeft={1}>
                      <Text color={config.theme.colors.muted}>{option.description}</Text>
                    </Box>
                  )}
                  {option.shortcut && (
                    <Box marginLeft={1}>
                      <Text color={config.theme.colors.comment || '#64747A'}>{option.shortcut}</Text>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
            <Box marginTop={1}>
              <Text color={config.theme.colors.muted}>↑↓ navigate • ↵ select • esc cancel</Text>
            </Box>
          </>
        );

      case 'input':
        return (
          <>
            <Text>{dialogConfig.message}</Text>
            {dialogConfig.detail && (
              <Box marginTop={1}>
                <Text color={config.theme.colors.muted}>{dialogConfig.detail}</Text>
              </Box>
            )}
            <Box marginTop={1} borderStyle="round" borderColor={config.theme.colors.border} paddingX={1}>
              <TextInput
                value={inputValue}
                onChange={setInputValue}
                placeholder={dialogConfig.inputPlaceholder || 'Enter value...'}
                onSubmit={() => { onResult(inputValue); onClose(); }}
              />
            </Box>
            <Box marginTop={1}>
              <Text color={config.theme.colors.muted}>↵ confirm • esc cancel</Text>
            </Box>
          </>
        );

      case 'progress':
        return (
          <>
            <Text>{dialogConfig.message}</Text>
            <Box marginTop={1} flexDirection="row">
              <Text color={config.theme.colors.accent}>{'█'.repeat(Math.round((dialogConfig.progress || 0) * 20))}</Text>
              <Text color={config.theme.colors.border}>{'░'.repeat(20 - Math.round((dialogConfig.progress || 0) * 20))}</Text>
              <Box marginLeft={1}>
                <Text color={config.theme.colors.muted}>{Math.round((dialogConfig.progress || 0) * 100)}%</Text>
              </Box>
            </Box>
            {dialogConfig.progressMessage && (
              <Box marginTop={1}>
                <Text color={config.theme.colors.muted}>{dialogConfig.progressMessage}</Text>
              </Box>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor={borderColor} minWidth={dialogWidth} maxWidth={dialogWidth}>
      <Box marginBottom={1}>
        <Text color={config.theme.colors.warning}>{DialogIcon[dialogConfig.type]} </Text>
        <Text bold>{dialogConfig.title}</Text>
      </Box>
      {renderContent()}
    </Box>
  );
};