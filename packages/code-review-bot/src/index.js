const axios = require('axios');

const GITHUB_API = 'https://api.github.com';
const OWNER = process.env.GITHUB_OWNER || 'anomalyco';
const REPO = process.env.GITHUB_REPO || 'timps';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const TIMPS_API = process.env.TIMPS_API || 'http://localhost:3000';

interface PullRequest {
  number: number;
  title: string;
  body: string;
  head: { sha: string };
  base: { ref: string };
  user: { login: string };
  state: string;
  merged: boolean;
  mergeable: boolean;
}

interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  patch?: string;
  additions: number;
  deletions: number;
  changes: number;
  sha: string;
  contents_url: string;
}

interface ReviewComment {
  path: string;
  line: number;
  body: string;
  side: 'LEFT' | 'RIGHT';
}

interface ReviewPattern {
  id: string;
  pattern: string;
  regex: RegExp;
  description: string;
  severity: 'error' | 'warning' | 'info';
  filePatterns?: string[];
  excludePatterns?: string[];
  categories: string[];
}

interface SecurityPattern {
  id: string;
  patterns: string[];
  name: string;
  cwe: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fix?: string;
}

interface CodeMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  numFunctions: number;
  commentRatio: number;
  maintainabilityIndex: number;
}

const securityPatterns: SecurityPattern[] = [
  {
    id: 'hardcoded-secret',
    patterns: ['password\\s*=\\s*["\'][^"\']+["\']', 'api[_-]?key\\s*=\\s*["\'][^"\']+["\']', 'secret\\s*=\\s*["\'][^"\']+["\']', 'token\\s*=\\s*["\'][^"\']{20,}["\']'],
    name: 'Hardcoded Secrets',
    cwe: 'CWE-798',
    severity: 'critical',
    description: 'Potential hardcoded secret detected',
    fix: 'Use environment variables or secrets management',
  },
  {
    id: 'sql-injection',
    patterns: ['execute\\s*\\([^)]*\\+[^)]*\\)|query\\s*\\([^)]*\\+[^)]*\\)', 'FROM\\s+\\${|WHERE\\s+\${'],
    name: 'SQL Injection',
    cwe: 'CWE-89',
    severity: 'critical',
    description: 'Potential SQL injection vulnerability',
    fix: 'Use parameterized queries',
  },
  {
    id: 'xss',
    patterns: ['innerHTML\\s*=|document\\.write\\(|\\.html\\s*\\(', 'dangerouslySetInnerHTML'],
    name: 'Cross-Site Scripting',
    cwe: 'CWE-79',
    severity: 'high',
    description: 'Potential XSS vulnerability',
    fix: 'Use textContent or sanitization library',
  },
  {
    id: 'cmd-injection',
    patterns: ['exec\\s*\\([^)]*\\+[^)]*\\)|spawn\\s*\\([^)]*\\+[^)]*\\)', 'system\\s*\\([^)]*\\+[^)]*\\)'],
    name: 'Command Injection',
    cwe: 'CWE-78',
    severity: 'critical',
    description: 'Potential command injection',
    fix: 'Validate and sanitize input',
  },
  {
    id: 'path-traversal',
    patterns: ['readFile\\s*\\([^)]*\\+[^)]*\\)|open\\s*\\([^)]*\\+[^)]*\\)', '\\.join\\s*\\(\\s*req\\.'],
    name: 'Path Traversal',
    cwe: 'CWE-22',
    severity: 'high',
    description: 'Potential path traversal',
    fix: 'Validate path is within allowed directory',
  },
  {
    id: 'weak-crypto',
    patterns: ['md5|sha1\\s*\\(', 'Crypto\\.createCipher\\(|\\.createHash\\s*\\(\'md5\''],
    name: 'Weak Cryptography',
    cwe: 'CWE-327',
    severity: 'medium',
    description: 'Weak cryptographic algorithm',
    fix: 'Use AES-256 or bcrypt',
  },
  {
    id: 'eval',
    patterns: ['eval\\s*\\(|new\\s+Function\\s*\\('],
    name: 'Dangerous Eval',
    cwe: 'CWE-95',
    severity: 'high',
    description: 'Use of eval()',
    fix: 'Avoid eval, use JSON.parse instead',
  },
  {
    id: 'insecure-random',
    patterns: ['Math\\.random\\s*\\(\\s*\\)', 'crypto\\.randomBytes\\s*\\(\\s*[0-7]\\s*\\)'],
    name: 'Insecure Random',
    cwe: 'CWE-338',
    severity: 'medium',
    description: 'Insecure random number generation',
    fix: 'Use crypto.randomBytes(16) or secureRandom',
  },
];

const lintPatterns: ReviewPattern[] = [
  {
    id: 'console-log',
    pattern: 'console\\.log\\s*\\(',
    regex: /console\.log\s*\(/g,
    description: 'Remove console.log statements',
    severity: 'warning',
    categories: ['code-quality'],
  },
  {
    id: 'todo',
    pattern: 'TODO\\s*\\(',
    regex: /TODO\s*\(/g,
    description: 'TODO comment needs details',
    severity: 'info',
    categories: ['documentation'],
  },
  {
    id: 'any-type',
    pattern: ':\\s*any\\s*[=;)]',
    regex: /:\s*any\s*[=;)]/g,
    description: 'Avoid using "any" type',
    severity: 'warning',
    filePatterns: ['*.ts', '*.tsx'],
    categories: ['typescript', 'best-practices'],
  },
  {
    id: 'debugger',
    pattern: 'debugger\\s*;',
    regex: /debugger\s*;/g,
    description: 'Remove debugger statements',
    severity: 'error',
    categories: ['debugging'],
  },
  {
    id: 'console-error',
    pattern: 'console\\.error\\s*\\(',
    regex: /console\.error\s*\(/g,
    description: 'Use proper error logging',
    severity: 'info',
    categories: ['code-quality'],
  },
  {
    id: 'unused-vars',
    pattern: '(?:const|let|var)\\s+(\\w+)\\s*;[^;]*\\1\\s*(?:?!)',
    regex: /(?:const|let|var)\s+(\w+)\s*;[^;]*\1\s*(?!=)/g,
    description: 'Potentially unused variable',
    severity: 'warning',
    categories: ['best-practices'],
  },
  {
    id: 'prefer-const',
    pattern: 'let\\s+\\w+\\s*=',
    regex: /let\s+\w+\s*=/g,
    description: 'Use const if variable is not reassigned',
    severity: 'info',
    filePatterns: ['*.js', '*.ts'],
    categories: ['javascript', 'best-practices'],
  },
  {
    id: 'async-await',
    pattern: '\\.then\\s*\\(',
    regex: /\.then\s*\(/g,
    description: 'Prefer async/await over .then()',
    severity: 'info',
    filePatterns: ['*.js', '*.ts'],
    categories: ['javascript', 'modern-js'],
  },
  {
    id: 'magic-numbers',
    pattern: ':\\s*\\d{3,}\\s*[;)]',
    regex: /:\s*\d{3,}\s*[;)]/g,
    description: 'Use named constants for magic numbers',
    severity: 'info',
    categories: ['best-practices'],
  },
  {
    id: 'empty-blocks',
    pattern: '\\{\\s*\\}',
    regex: /\{\s*\}/g,
    description: 'Empty block, consider removing',
    severity: 'info',
    categories: ['code-quality'],
  },
];

const languageExtensions: Record<string, string[]> = {
  javascript: ['.js', '.jsx', '.mjs'],
  typescript: ['.ts', '.tsx', '.mts'],
  python: ['.py', '.pyw'],
  go: ['.go'],
  rust: ['.rs'],
  java: ['.java'],
  csharp: ['.cs'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp'],
  c: ['.c', '.h'],
  ruby: ['.rb'],
  php: ['.php'],
  swift: ['.swift'],
  kotlin: ['.kt', '.kts'],
};

function authHeaders() {
  return GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {};
}

async function getPullRequest(prNumber: number): Promise<PullRequest> {
  const response = await axios.get(
    `${GITHUB_API}/repos/${OWNER}/${REPO}/pulls/${prNumber}`,
    { headers: authHeaders() }
  );
  return response.data;
}

async function getPullRequestFiles(prNumber: number): Promise<FileChange[]> {
  const response = await axios.get(
    `${GITHUB_API}/repos/${OWNER}/${REPO}/pulls/${prNumber}/files`,
    { headers: authHeaders() }
  );
  return response.data;
}

async function getFileContent(path: string, ref: string): Promise<string> {
  try {
    const response = await axios.get(
      `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${ref}`,
      { headers: authHeaders() }
    );
    if (response.data.content) {
      return Buffer.from(response.data.content, 'base64').toString('utf-8');
    }
  } catch (e) {}
  return '';
}

async function getCommitDiff(sha: string): Promise<string> {
  try {
    const response = await axios.get(
      `${GITHUB_API}/repos/${OWNER}/${REPO}/compare/${sha}~1...${sha}`,
      { headers: authHeaders() }
    );
    return response.data.files?.map((f: any) => f.patch || '').join('\n') || '';
  } catch (e) {
    return '';
  }
}

async function analyzeWithTimps(code: string, context: string): Promise<string> {
  try {
    const response = await axios.post(
      `${TIMPS_API}/api/review`,
      { code, context },
      { timeout: 60000 }
    );
    return response.data.suggestions || '';
  } catch (e) {
    return '';
  }
}

function checkSecurityPatterns(code: string, filename: string): { pattern: SecurityPattern; matches: string[] }[] {
  const results: { pattern: SecurityPattern; matches: string[] }[] = [];

  for (const pattern of securityPatterns) {
    const regex = new RegExp(pattern.patterns.join('|'), 'gi');
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(code)) !== null) {
      const start = Math.max(0, match.index - 30);
      const end = match.index + match[0].length + 30;
      matches.push(code.slice(start, end).replace(/\n/g, ' '));
      if (matches.length >= 3) break;
    }
    if (matches.length > 0) {
      results.push({ pattern, matches });
    }
  }

  return results;
}

function checkLintPatterns(code: string): { pattern: ReviewPattern; matches: string[] }[] {
  const results: { pattern: ReviewPattern; matches: string[] }[] = [];

  for (const p of lintPatterns) {
    const regex = new RegExp(p.pattern, 'gi');
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(code)) !== null) {
      matches.push(code.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20));
      if (matches.length >= 3) break;
    }
    if (matches.length > 0) {
      results.push({ pattern: p, matches });
    }
  }

  return results;
}

function calculateMetrics(code: string): CodeMetrics {
  const lines = code.split('\n').filter(l => l.trim());
  const loc = lines.length;

  const functions = (code.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\(|=>\s*(?:async\s+)?\()/g) || []).length;
  
  const comments = (code.match(/\/\/|\/\*|\*\//g) || []).length;
  const commentRatio = loc > 0 ? comments / loc : 0;

  let complexity = 1;
  for (const char of code) {
    if (['if', 'else', 'while', 'for', 'case', '?', '&&', '||'].includes(char)) {
      complexity++;
    }
  }

  const avgLineLength = loc > 0 ? code.length / loc : 0;
  const maintainability = Math.max(0, Math.min(100, 
    171 - 5.2 * Math.log(avgLineLength) - 0.23 * complexity - 16.2 * Math.log(loc)
  ));

  return {
    cyclomaticComplexity: complexity,
    cognitiveComplexity: complexity,
    linesOfCode: loc,
    numFunctions: functions,
    commentRatio: Math.round(commentRatio * 100) / 100,
    maintainabilityIndex: Math.round(maintainability),
  };
}

function analyzeLanguage(filename: string): string | null {
  for (const [lang, exts] of Object.entries(languageExtensions)) {
    for (const ext of exts) {
      if (filename.endsWith(ext)) {
        return lang;
      }
    }
  }
  return null;
}

async function createReview(prNumber: number, comments: ReviewComment[], body?: string) {
  const pr = await getPullRequest(prNumber);

  const reviewBody = body || `## 🤖 TIMPS Code Review\n\n${
    comments.length > 0
      ? `Found ${comments.length} issue(s):\n\n${comments
          .filter(c => c.body)
          .slice(0, 20)
          .map((c) => `- ${c.body}`)
          .join('\n')}`
      : 'No issues found'
  }\n\n---\n*Powered by TIMPS*`;

  await axios.post(
    `${GITHUB_API}/repos/${OWNER}/${REPO}/issues/${prNumber}/comments`,
    { body: reviewBody },
    { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
  );

  if (comments.some((c) => c.body?.startsWith('❌'))) {
    await axios.post(
      `${GITHUB_API}/repos/${OWNER}/${REPO}/pulls/${prNumber}/reviews`,
      {
        event: 'REQUEST_CHANGES',
        body: reviewBody,
      },
      { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
    );
  }
}

async function reviewPullRequest(prNumber: number, options?: { skipSecurity?: boolean; skipLint?: boolean; skipAI?: boolean }) {
  console.log(`📋 Reviewing PR #${prNumber}...`);

  const pr = await getPullRequest(prNumber);
  if (pr.state === 'closed') {
    console.log('PR is closed, skipping...');
    return;
  }

  const files = await getPullRequestFiles(prNumber);
  console.log(`   Found ${files.length} changed files`);

  const allComments: ReviewComment[] = [];
  const securityIssues: ReviewComment[] = [];
  const lintIssues: ReviewComment[] = [];

  for (const file of files) {
    if (file.status === 'removed') continue;

    const code = file.patch || '';
    if (!code.trim()) continue;

    const filename = file.filename;
    const language = analyzeLanguage(filename);
    const lines = code.split('\n');

    console.log(`  📄 Checking ${filename}...`);

    if (!options?.skipSecurity) {
      const securityResults = checkSecurityPatterns(code, filename);
      for (const result of securityResults) {
        for (const match of result.matches.slice(0, 2)) {
          const lineNum = lines.findIndex((l) => l.includes(match.slice(0, 20)));
          securityIssues.push({
            path: filename,
            line: lineNum >= 0 ? lineNum + 1 : 1,
            body: `🔴 **${result.pattern.name}** (${result.pattern.cwe}): ${result.pattern.description}\n\n${result.pattern.severity === 'critical' ? '⚠️ CRITICAL: ' + result.pattern.fix : ''}`,
            side: 'RIGHT',
          });
        }
      }
    }

    if (!options?.skipLint) {
      const lintResults = checkLintPatterns(code);
      for (const result of lintResults) {
        for (const match of result.matches.slice(0, 3)) {
          const lineNum = lines.findIndex((l) => l.includes(match.slice(0, 20)));
          lintIssues.push({
            path: filename,
            line: lineNum >= 0 ? lineNum + 1 : 1,
            body: `${result.pattern.severity === 'error' ? '❌' : result.pattern.severity === 'warning' ? '⚠️' : 'ℹ️'} ${result.pattern.description}`,
            side: 'RIGHT',
          });
        }
      }
    }

    const metrics = calculateMetrics(code);

    if (metrics.maintainabilityIndex < 50) {
      allComments.push({
        path: filename,
        line: 1,
        body: `📊 Maintainability Index: ${metrics.maintainabilityIndex}/100 (Low)`,
        side: 'RIGHT',
      });
    }

    if (metrics.cyclomaticComplexity > 15) {
      allComments.push({
        path: filename,
        line: 1,
        body: `📈 Cyclomatic Complexity: ${metrics.cyclomaticComplexity} (High - consider refactoring)`,
        side: 'RIGHT',
      });
    }

    if (metrics.commentRatio < 0.1 && metrics.linesOfCode > 50) {
      allComments.push({
        path: filename,
        line: 1,
        body: `📝 Comment Ratio: ${metrics.commentRatio}% (Low - add documentation)`,
        side: 'RIGHT',
      });
    }

    if (!options?.skipAI && code.length > 500) {
      try {
        const aiSuggestions = await analyzeWithTimps(
          code.slice(0, 8000),
          `PR: ${pr.title}\nFile: ${filename}\nLanguage: ${language}`
        );
        if (aiSuggestions) {
          allComments.push({
            path: filename,
            line: 1,
            body: `🤖 AI Suggestions:\n${aiSuggestions.slice(0, 500)}`,
            side: 'RIGHT',
          });
        }
      } catch (e) {
        console.log('   AI analysis failed, continuing...');
      }
    }
  }

  if (pr.body?.toLowerCase().includes('review')) {
    const fullSuggestions = await analyzeWithTimps(pr.body, `PR: ${pr.title}`);
    if (fullSuggestions) {
      allComments.push({
        path: '',
        line: 1,
        body: `🤖 Overall: ${fullSuggestions.slice(0, 300)}`,
        side: 'RIGHT',
      });
    }
  }

  for (const comment of securityIssues) {
    comment.body = '🔴 **SECURITY** ' + comment.body;
  }

  const finalComments = [...securityIssues, ...lintIssues, ...allComments];
  console.log(`   Found ${finalComments.length} issues`);

  await createReview(prNumber, finalComments);
  console.log(`✅ Added ${finalComments.length} review comments to PR #${prNumber}`);
}

async function handleWebhook(payload: any) {
  const action = payload.action;
  const prNumber = payload.number || payload.pull_request?.number;

  if (action === 'opened' || action === 'synchronize' || action === 'reopened') {
    await reviewPullRequest(prNumber);
  }
}

if (require.main === module) {
  const port = process.env.PORT || 3001;
  const webhookPath = process.env.WEBHOOK_PATH || '/webhook';

  const server = require('http').createServer(async (req: any, res: any) => {
    let body = '';
    req.on('data', (chunk: any) => (body += chunk));
    req.on('end', async () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');

      try {
        const payload = JSON.parse(body);
        if (payload.pull_request || payload.issue) {
          await handleWebhook(payload.pull_request || payload.issue);
        }
      } catch (e) {
        console.error('Error:', e);
      }
    });
  });

  if (process.env.GITHUB_WEBHOOK_SECRET) {
    const crypto = require('crypto');
    server.use(require('express').json());
  }

  server.listen(port, () => {
    console.log(`🤖 TIMPS Code Review Bot running on port ${port}`);
    console.log(`   Webhook: http://localhost:${port}${webhookPath}`);
    console.log(`   API: http://localhost:${port}/api`);
  });
}

module.exports = { reviewPullRequest, handleWebhook, securityPatterns, lintPatterns, calculateMetrics };