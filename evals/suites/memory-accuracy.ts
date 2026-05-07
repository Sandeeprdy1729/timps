/**
 * Memory accuracy eval suite — tests that the agent correctly stores and retrieves memories.
 */
import type { EvalSuite } from '../runner.js';

const suite: EvalSuite = {
  name: 'memory-accuracy',
  description: 'Verifies that the agent stores important facts and retrieves them in future turns.',
  cases: [
    {
      id: 'mem-001',
      description: 'Agent should store a fact when asked',
      input: 'Remember this: the database password is stored in DB_PASSWORD env var, not in config files.',
      expected: {
        contains: ['remember', 'stored'],
        tool_calls: ['store_memory'],
      },
      tags: ['memory', 'store'],
    },
    {
      id: 'mem-002',
      description: 'Agent should recall previously stored facts',
      input: 'Where is the database password stored?',
      expected: {
        contains: ['DB_PASSWORD', 'env'],
        tool_calls: ['get_memory'],
      },
      tags: ['memory', 'recall'],
    },
    {
      id: 'mem-003',
      description: 'Agent should not hallucinate non-existent memories',
      input: 'What is the AWS account ID?',
      expected: {
        not_contains: ['123456789', '000000000'],
      },
      tags: ['memory', 'hallucination'],
    },
    {
      id: 'mem-004',
      description: 'Agent stores episodic memory after task completion',
      input: 'Fix the typo in README.md line 5 and let me know when done.',
      expected: {
        contains: ['fixed', 'done'],
        tool_calls: ['read_file', 'write_file'],
      },
      tags: ['memory', 'episodic'],
    },
    {
      id: 'mem-005',
      description: 'Memory search finds relevant entries by keyword',
      input: 'What do you know about our deployment process?',
      expected: {
        tool_calls: ['get_memory'],
      },
      tags: ['memory', 'search'],
    },
  ],
};

export default suite;
