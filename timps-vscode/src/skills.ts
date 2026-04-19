// ============================================================
// TIMPS Skills — Adapted from GLM skills for TIMPS
// Stored locally at ~/.timps/skills/ as .md files
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SKILLS_DIR = path.join(os.homedir(), '.timps', 'skills');

export interface TIMPsSkill {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    content: string;
}

// Bundled skills adapted from GLM + original TIMPS skills
export const BUNDLED_SKILLS: TIMPsSkill[] = [
    {
        id: 'bug-fixer',
        name: 'Bug Fixer',
        description: 'TIMPS-Coder specialty: explain root cause + complete fix',
        category: 'coding',
        icon: '🐛',
        content: `---
name: bug-fixer
category: coding
description: TIMPS-Coder specialty — explain root cause and provide complete fix
---

# Bug Fixer Skill

When fixing bugs, ALWAYS use this exact format:

## 🔍 Root Cause
[Explain the bug in plain English — what went wrong and why. Be specific about the line/logic.]

## ✅ Fixed Code
\`\`\`[language]
[Complete corrected code — never partial]
\`\`\`

## 📝 What Changed
[Bullet list: each change made and why]

## 🛡️ Prevention
[How to avoid this class of bug in future]

Rules:
- ALWAYS explain before fixing
- ALWAYS show complete code (never truncate)
- Reference the exact line(s) causing the issue
- Check for related bugs in the same file
`
    },
    {
        id: 'code-reviewer',
        name: 'Code Reviewer',
        description: 'Deep code review with 🔴/🟡/🟢 severity levels',
        category: 'coding',
        icon: '👁',
        content: `---
name: code-reviewer
category: coding
description: Deep code review with severity categorization
---

# Code Review Skill

Use this exact format for every review:

## Code Review — [filename]

### 🔴 Critical Issues (must fix before merge)
- Security vulnerabilities
- Data loss risks
- Race conditions / crashes

### 🟡 Warnings (fix soon)
- Performance bottlenecks
- Anti-patterns / bad practices
- Missing error handling

### 🟢 Suggestions (optional improvements)
- Readability
- Code style
- Better algorithms

### 📊 Quality Score: X/10
[2-sentence overall assessment]

### 🏆 What's Done Well
[Always mention at least 2 positives]

Rules:
- Never be vague — cite specific line numbers
- Show fixed code for every 🔴 issue
- Keep suggestions constructive
`
    },
    {
        id: 'full-stack-dev',
        name: 'Full-Stack Dev',
        description: 'Next.js, TypeScript, Tailwind, Prisma — adapted from GLM fullstack-dev skill',
        category: 'coding',
        icon: '🌐',
        content: `---
name: full-stack-dev
category: coding
description: Full-stack web development guidance — Next.js, TypeScript, Tailwind, Prisma
---

# Full-Stack Development Skill (TIMPS-adapted)

## Stack
- Next.js App Router (TypeScript)
- Tailwind CSS for styling
- Prisma ORM for database
- shadcn/ui for components

## Rules
- Use existing shadcn/ui components from \`src/components/ui/\`
- Card padding: \`p-4\` or \`p-6\`, spacing: \`gap-4\` or \`gap-6\`
- Long lists: \`max-h-96 overflow-y-auto\` with custom scrollbar
- Server components by default, \`"use client"\` only when needed
- API routes in \`app/api/\` using Route Handlers
- Always handle loading and error states

## Response Format
For every feature request:
1. **Plan**: List files to create/modify
2. **Code**: Show complete implementation
3. **Test**: Suggest how to verify it works

## Common Patterns
\`\`\`typescript
// Server Action
'use server';
export async function myAction(data: FormData) { ... }

// Client component with state
'use client';
import { useState } from 'react';

// Prisma query
const users = await prisma.user.findMany({ where: { active: true } });
\`\`\`
`
    },
    {
        id: 'test-writer',
        name: 'Test Writer',
        description: 'Comprehensive unit tests with edge cases — Jest, pytest, JUnit',
        category: 'coding',
        icon: '🧪',
        content: `---
name: test-writer
category: coding  
description: Write comprehensive unit tests with edge cases
---

# Test Writer Skill

## Framework Selection
- TypeScript/JavaScript → Jest
- Python → pytest
- Java → JUnit 5
- Go → testing package
- Rust → cargo test

## Test Structure (ARRANGE-ACT-ASSERT)
\`\`\`typescript
describe('ComponentName', () => {
    describe('methodName', () => {
        it('should [expected behavior] when [condition]', () => {
            // Arrange
            const input = setupTestData();
            // Act
            const result = componentName.method(input);
            // Assert
            expect(result).toBe(expectedValue);
        });
    });
});
\`\`\`

## Always Include
- Happy path (normal input)
- Null/undefined/empty inputs
- Boundary values (0, max, min, -1)
- Error scenarios (throws expected errors)
- Async/promise rejection cases

## Naming Convention
- \`should [behavior] when [condition]\`
- \`returns [value] for [input]\`
- \`throws [error] when [condition]\`
`
    },
    {
        id: 'doc-writer',
        name: 'Doc Writer',
        description: 'Generate JSDoc, docstrings, inline comments — adapted from GLM writing skill',
        category: 'coding',
        icon: '📝',
        content: `---
name: doc-writer
category: coding
description: Generate comprehensive documentation for code
---

# Documentation Skill

## Docstring Formats

### TypeScript/JavaScript (JSDoc)
\`\`\`typescript
/**
 * Brief description of what this does.
 * @param name - Description of name parameter
 * @param options - Configuration options
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 * @example
 * const result = myFunction('test', { verbose: true });
 */
\`\`\`

### Python (Google style)
\`\`\`python
def my_function(param1: str, param2: int) -> bool:
    """Brief description.

    Args:
        param1: Description of param1.
        param2: Description of param2.

    Returns:
        True if successful, False otherwise.

    Raises:
        ValueError: If param1 is empty.

    Example:
        >>> my_function("hello", 42)
        True
    """
\`\`\`

## Rules
- Document ALL public functions/methods/classes
- Use inline comments for non-obvious logic only
- Keep comments at same abstraction level as code
- Update docs when code changes
`
    },
    {
        id: 'security-auditor',
        name: 'Security Auditor',
        description: 'Find security vulnerabilities — injection, XSS, auth flaws',
        category: 'security',
        icon: '🔒',
        content: `---
name: security-auditor
category: security
description: Security audit for code — finds and fixes vulnerabilities
---

# Security Audit Skill

## Vulnerability Checklist

### Injection
- [ ] SQL injection (use parameterized queries)
- [ ] Command injection (avoid exec with user input)
- [ ] NoSQL injection (sanitize MongoDB queries)

### Authentication & Authorization
- [ ] Hardcoded secrets/API keys
- [ ] Weak password hashing (use bcrypt/argon2)
- [ ] Missing authorization checks
- [ ] JWT validation (verify signature, expiry)

### Data Exposure
- [ ] Sensitive data in logs
- [ ] PII in error messages
- [ ] Unencrypted sensitive data at rest

### Input Validation
- [ ] XSS (escape output, CSP headers)
- [ ] Path traversal (../../../etc/passwd)
- [ ] File upload validation

## Output Format
\`\`\`
🚨 CRITICAL — [Vuln name]
Location: [file:line]
Issue: [what's wrong]
Fix: [exact code change]
\`\`\`
`
    },
    {
        id: 'perf-optimizer',
        name: 'Performance Optimizer',
        description: 'Analyze complexity, find bottlenecks, optimize algorithms',
        category: 'coding',
        icon: '⚡',
        content: `---
name: perf-optimizer
category: coding
description: Performance analysis and optimization
---

# Performance Optimizer Skill

## Analysis Framework
1. Identify the hot path (where most time is spent)
2. Measure before optimizing (benchmark first)
3. Fix algorithm first, micro-optimize last

## Common Patterns to Fix

### O(n²) → O(n log n) or O(n)
\`\`\`
❌ Nested loops for search → ✅ Use Set/Map for O(1) lookup
❌ Array.includes in loop → ✅ Create Set once, check in O(1)
❌ Sort inside loop → ✅ Sort once outside loop
\`\`\`

### Memory
\`\`\`
❌ Load entire file → ✅ Stream in chunks
❌ Accumulate results in array → ✅ Process and discard
❌ Duplicate data structures → ✅ Share references
\`\`\`

## Complexity Table
| Operation | Best | Worst |
|-----------|------|-------|
| Array lookup | O(1) | O(1) |
| Array search | O(n) | O(n) |
| Hash lookup | O(1) | O(n) |
| Binary search | O(log n) | O(log n) |
| Sort | O(n log n) | O(n²) |

## Report Format
Before: O(?) time, O(?) space
After: O(?) time, O(?) space
Improvement: Nx faster
`
    },
    {
        id: 'api-designer',
        name: 'API Designer',
        description: 'REST API design, OpenAPI specs, best practices',
        category: 'coding',
        icon: '🔌',
        content: `---
name: api-designer
category: coding
description: REST API design guidance and OpenAPI spec generation
---

# API Design Skill

## REST Conventions
\`\`\`
GET    /users          → list users
POST   /users          → create user  
GET    /users/:id      → get user
PUT    /users/:id      → full update
PATCH  /users/:id      → partial update
DELETE /users/:id      → delete user
\`\`\`

## Response Format (always consistent)
\`\`\`json
{
  "data": {...},
  "meta": { "total": 100, "page": 1, "pageSize": 20 },
  "error": null
}

// Error response
{
  "data": null,
  "error": { "code": "NOT_FOUND", "message": "User not found", "field": "id" }
}
\`\`\`

## Status Codes
- 200 OK, 201 Created, 204 No Content
- 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
- 422 Unprocessable Entity (validation), 429 Rate Limited
- 500 Internal Server Error

## Rules
- Versioning: /api/v1/...
- Pagination: cursor-based for large sets
- Rate limiting: 429 with Retry-After header
- CORS: explicit origin whitelist
- Validate all inputs before processing
`
    },
    {
        id: 'refactor-master',
        name: 'Refactor Master',
        description: 'Clean code principles, design patterns, SOLID, DRY',
        category: 'coding',
        icon: '🔧',
        content: `---
name: refactor-master
category: coding
description: Refactoring with clean code principles and design patterns
---

# Refactor Master Skill

## Clean Code Principles

### Names
- Functions: verb + noun → \`getUserById()\`, \`sendEmail()\`
- Booleans: \`is/has/can\` prefix → \`isActive\`, \`hasPermission\`
- Constants: SCREAMING_SNAKE → \`MAX_RETRY_COUNT\`

### Functions
- Single responsibility (does ONE thing)
- Max 20 lines (prefer fewer)
- Max 3 parameters (use object if more)
- No side effects unless named explicitly

### DRY (Don't Repeat Yourself)
- Extract repeated logic into functions
- Use constants for magic numbers/strings
- Shared types in separate files

## Common Refactors
\`\`\`
❌ Long if-else chains → ✅ Map/switch/strategy pattern
❌ God functions (100+ lines) → ✅ Extract smaller functions
❌ Magic numbers (3.14, 86400) → ✅ Named constants (PI, SECONDS_PER_DAY)
❌ Callback hell → ✅ Async/await or Promise chain
❌ Duplicate code (copy-paste) → ✅ Extract to shared utility
\`\`\`

## Output Format
For each refactor:
1. What pattern was applied
2. Before/after code
3. Why this is better
`
    }
];

export function ensureSkillsDir(): void {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

export function installBundledSkills(): void {
    ensureSkillsDir();
    for (const skill of BUNDLED_SKILLS) {
        const fp = path.join(SKILLS_DIR, `${skill.id}.md`);
        if (!fs.existsSync(fp)) {
            fs.writeFileSync(fp, skill.content, 'utf-8');
        }
    }
}

export function getInstalledSkills(): TIMPsSkill[] {
    ensureSkillsDir();
    const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
    return files.map(f => {
        const content = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8');
        const meta = parseFrontmatter(content);
        return {
            id: f.replace('.md', ''),
            name: meta.name || f.replace('.md', ''),
            description: meta.description || '',
            category: meta.category || 'general',
            icon: meta.icon || '📖',
            content
        };
    });
}

export function getSkillContext(activeSkillIds?: string[]): string {
    const skills = getInstalledSkills();
    const active = activeSkillIds ? skills.filter(s => activeSkillIds.includes(s.id)) : skills;
    if (active.length === 0) return '';
    const parts = ['## Active TIMPS Skills'];
    for (const s of active) {
        const body = stripFrontmatter(s.content);
        if (body.trim()) parts.push(`### ${s.name}\n${body.slice(0, 1500)}`);
    }
    return parts.join('\n\n');
}

function parseFrontmatter(content: string): Record<string, string> {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const meta: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
        const [key, ...rest] = line.split(':');
        if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
    }
    return meta;
}

function stripFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}
