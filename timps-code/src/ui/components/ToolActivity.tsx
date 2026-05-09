import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface ToolActivityProps {
  toolName: string;
}

export const ToolActivity = ({ toolName }: ToolActivityProps) => {
  return (
    <Box>
      <Text color="#E8C94A">
        <Spinner type="dots" />
      </Text>
      <Box marginLeft={1}>
        <Text dimColor>
          🤖 Running: <Text color="#4A8C7A">{toolName}</Text>...
        </Text>
      </Box>
    </Box>
  );
};
