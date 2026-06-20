import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { t, icons } from '../../../config/theme.js';
import { loadTUIConfig } from '../../../config/tui/index.js';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  timestamp: number;
}

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const config = loadTUIConfig();

const variantColors: Record<ToastVariant, string> = {
  info: config.theme.colors.info || '#7EC8B8',
  success: config.theme.colors.success || '#28A070',
  warning: config.theme.colors.warning || '#E8C94A',
  error: config.theme.colors.error || '#C83838',
};

const variantIcons: Record<ToastVariant, string> = {
  info: 'ℹ',
  success: '✔',
  warning: '⚠',
  error: '✘',
};

export const Toast = ({ toasts, onDismiss }: ToastProps) => {
  const [visible, setVisible] = useState<Set<string>>(new Set());

  useEffect(() => {
    for (const toast of toasts) {
      setVisible(prev => new Set(prev).add(toast.id));
      if (toast.duration > 0) {
        const timer = setTimeout(() => {
          onDismiss(toast.id);
          setVisible(prev => {
            const next = new Set(prev);
            next.delete(toast.id);
            return next;
          });
        }, toast.duration);
      }
    }
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  const termWidth = process.stdout.columns || 80;
  const toastWidth = Math.min(termWidth - 4, 60);

  return (
    <Box flexDirection="column" gap={1} paddingBottom={1}>
      {toasts.map((toast) => (
        <Box
          key={toast.id}
          flexDirection="row"
          paddingX={1}
          paddingY={0}
          borderStyle="round"
          borderColor={variantColors[toast.variant]}
          width={toastWidth}
        >
          <Text color={variantColors[toast.variant]}>{variantIcons[toast.variant]} </Text>
          <Text color={variantColors[toast.variant]} bold>
            {toast.message}
          </Text>
        </Box>
      ))}
    </Box>
  );
};