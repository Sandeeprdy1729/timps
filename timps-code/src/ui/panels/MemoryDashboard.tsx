import React from 'react';
import { Box, Text } from 'ink';

interface MemoryDashboardProps {
  memoryCount: number;
  openTodos: number;
  cwd: string;
}

export const MemoryDashboard = ({ memoryCount, openTodos, cwd }: MemoryDashboardProps) => {
  const project = cwd.replace(process.env.HOME || '', '~');
  return (
    <Box flexDirection="row" paddingX={1} paddingY={0} borderStyle="single" borderColor="#2D5A4F" marginBottom={1}>
      <Text bold color="#4A8C7A">TIMPS</Text>
      <Text dimColor>  {project}</Text>
      {memoryCount > 0 && (
        <>
          <Text dimColor>  ·  </Text>
          <Text color="#28A070">{memoryCount} facts</Text>
        </>
      )}
      {openTodos > 0 && (
        <>
          <Text dimColor>  ·  </Text>
          <Text color="#C8B94F">{openTodos} task{openTodos !== 1 ? 's' : ''}</Text>
        </>
      )}
    </Box>
  );
};
