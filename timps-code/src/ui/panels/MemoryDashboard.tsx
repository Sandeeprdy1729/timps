import React from 'react';
import { Box, Text } from 'ink';

interface MemoryDashboardProps {
  memoryCount: number;
  openTodos: number;
  cwd: string;
}

export const MemoryDashboard = ({ memoryCount, openTodos, cwd }: MemoryDashboardProps) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Box>
        <Text bold color="cyan">TIMPS Dashboard</Text>
      </Box>
      <Box flexDirection="row">
        <Box flexDirection="column" marginRight={4}>
          <Text color="grey">Directory:</Text>
          <Text>{cwd}</Text>
        </Box>
        <Box flexDirection="column" marginRight={4}>
          <Text color="grey">Memory Items:</Text>
          <Text color={memoryCount > 0 ? 'green' : 'grey'}>{memoryCount}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="grey">Open Tasks:</Text>
          <Text color={openTodos > 0 ? 'yellow' : 'green'}>{openTodos}</Text>
        </Box>
      </Box>
    </Box>
  );
};
