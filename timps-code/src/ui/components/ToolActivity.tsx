import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface ToolActivityProps {
  toolName: string;
}

export const ToolActivity = ({ toolName }: ToolActivityProps) => {
  return (
    <Box>
      <Text color="#C8B94F">
        <Spinner type="dots" />
      </Text>
      <Text dimColor>  Running </Text>
      <Text color="#4A8C7A" bold>{toolName}</Text>
      <Text dimColor>…</Text>
    </Box>
  );
};
