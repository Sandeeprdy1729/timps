/**
 * Task completion eval suite — tests that the agent can complete common dev tasks.
 */
import type { EvalSuite } from '../runner.js';

const suite: EvalSuite = {
  name: 'task-completion',
  description: 'Verifies the agent completes coding tasks correctly and uses the right tools.',
  cases: [
    {
      id: 'task-001',
      description: 'Agent can read a file',
      input: 'Read the contents of README.md',
      expected: {
        tool_calls: ['read_file'],
        not_contains: ['error', 'failed'],
      },
      tags: ['file', 'read'],
    },
    {
      id: 'task-002',
      description: 'Agent can list directory contents',
      input: 'List all files in the current directory',
      expected: {
        tool_calls: ['list_dir'],
      },
      tags: ['file', 'list'],
    },
    {
      id: 'task-003',
      description: 'Agent can run git status',
      input: 'Show me the current git status',
      expected: {
        tool_calls: ['git_status'],
      },
      tags: ['git'],
    },
    {
      id: 'task-004',
      description: 'Agent writes a file when asked',
      input: 'Create a file called /tmp/timps-test.txt with content "hello from TIMPS"',
      expected: {
        tool_calls: ['write_file'],
        contains: ['created', 'written'],
      },
      tags: ['file', 'write'],
    },
    {
      id: 'task-005',
      description: 'Agent uses shell for npm commands',
      input: 'What version of Node.js is installed?',
      expected: {
        tool_calls: ['shell'],
        regex: 'v\\d+\\.\\d+\\.\\d+',
      },
      tags: ['shell'],
    },
    {
      id: 'task-006',
      description: 'Agent handles tool errors gracefully',
      input: 'Read the file /nonexistent/path/file.txt',
      expected: {
        contains: ['not found', 'error', 'cannot', "doesn't exist"],
        not_contains: ['undefined', 'null', 'TypeError'],
      },
      tags: ['error-handling'],
    },
    {
      id: 'task-007',
      description: 'Agent can search the web',
      input: 'Fetch the contents of https://example.com',
      expected: {
        tool_calls: ['web_fetch'],
        contains: ['example'],
      },
      tags: ['web'],
      timeout_ms: 15000,
    },
    {
      id: 'task-008',
      description: 'Agent explains code without making up function names',
      input: 'Explain what this does: const x = arr.filter(Boolean).map(s => s.trim())',
      expected: {
        contains: ['filter', 'truthy', 'trim'],
        not_contains: ['undefined', 'error'],
      },
      tags: ['code-understanding'],
    },
  ],
};

export default suite;
