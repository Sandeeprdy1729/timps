/**
 * Provider benchmark eval suite — runs the same prompts across all providers.
 */
import type { EvalSuite } from '../runner.js';

const suite: EvalSuite = {
  name: 'provider-benchmark',
  description: 'Compares all configured providers on a standard set of prompts.',
  cases: [
    {
      id: 'bench-001',
      description: 'Basic reasoning',
      input: 'What is 17 multiplied by 23? Show your work.',
      expected: {
        contains: ['391'],
      },
      tags: ['math', 'reasoning'],
    },
    {
      id: 'bench-002',
      description: 'Code generation',
      input: 'Write a TypeScript function that returns the nth Fibonacci number using memoization.',
      expected: {
        contains: ['function', 'memo', 'Map'],
        regex: 'function.*fibonacci|const.*fibonacci',
      },
      tags: ['codegen'],
    },
    {
      id: 'bench-003',
      description: 'Instruction following',
      input: 'List exactly 5 programming languages, one per line, starting with Python.',
      expected: {
        contains: ['Python'],
        regex: '(?:^|\\n)(?:1\\.|2\\.|3\\.|4\\.|5\\.)',
      },
      tags: ['instruction'],
    },
    {
      id: 'bench-004',
      description: 'Tool usage decision',
      input: 'Check if the file package.json exists in the current directory.',
      expected: {
        tool_calls: ['shell', 'list_dir', 'read_file'],  // any one of these
      },
      tags: ['tool-routing'],
    },
    {
      id: 'bench-005',
      description: 'Memory-aware response',
      input: 'What do you remember about this project?',
      expected: {
        tool_calls: ['get_memory'],
      },
      tags: ['memory'],
    },
  ],
};

export default suite;
