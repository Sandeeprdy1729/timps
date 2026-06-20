import { SandboxRouter } from './packages/memory-core/src/sandbox/Sandbox.js';
import { ConstitutionalFilter } from './packages/memory-core/src/safety/ConstitutionalFilter.js';
import { ConstitutionalSandbox } from './packages/memory-core/src/sandbox/ConstitutionalSandbox.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timps-demo-'));
console.log(`[demo] working dir: ${dir}\n`);

const filter = new ConstitutionalFilter(dir);
const cs = new ConstitutionalSandbox(dir, filter);

(async () => {
  // ── Test 1: Simple Python execution in a sandbox ──
  console.log('=== Test 1: Python sandbox ===');
  const r1 = await cs.maybeExecute('```python\nprint("hello from sandboxed python")\nprint(2 + 2)\n```');
  if (r1.executed && r1.result) {
    console.log(`  exit=${r1.result.exitCode} dur=${r1.result.durationMs}ms`);
    console.log(`  stdout: ${r1.result.stdout.trim()}`);
  } else {
    console.log(`  analysis: ${JSON.stringify(r1.analysis)}`);
    if (r1.record) console.log(`  record: ${r1.record.stderrPreview}`);
  }

  // ── Test 2: Node.js execution ──
  console.log('\n=== Test 2: Node sandbox ===');
  const r2 = await cs.maybeExecute('```javascript\nconsole.log("node says hi");\nconst sum = [1,2,3,4,5].reduce((a,b) => a+b, 0);\nconsole.log("sum =", sum);\n```');
  if (r2.executed && r2.result) {
    console.log(`  exit=${r2.result.exitCode} dur=${r2.result.durationMs}ms`);
    console.log(`  stdout: ${r2.result.stdout.trim()}`);
  }

  // ── Test 3: Bash with filesystem scope ──
  console.log('\n=== Test 3: Bash sandbox (filesystem scoped) ===');
  const r3 = await cs.maybeExecute('```bash\necho "PWD=$PWD"\necho "HOME=$HOME"\necho "PATH=$PATH"\nls -la\n```');
  if (r3.executed && r3.result) {
    console.log(`  exit=${r3.result.exitCode} dur=${r3.result.durationMs}ms`);
    console.log(`  stdout: ${r3.result.stdout.trim()}`);
  }

  // ── Test 4: Constitution blocks unsafe input ──
  console.log('\n=== Test 4: Unsafe input (Constitution blocks) ===');
  const r4 = await cs.maybeExecute('```python\nimport os\nprint(os.environ.get("AWS_SECRET_ACCESS_KEY", "no key"))\n```\nAWS_SECRET_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE');
  if (r4.executed) {
    console.log(`  unexpectedly executed!`);
  } else {
    console.log(`  blocked: ${r4.analysis.reason}`);
    if (r4.record) console.log(`  record.stderrPreview: ${r4.record.stderrPreview}`);
  }

  // ── Test 5: Network access (should fail because network=none) ──
  console.log('\n=== Test 5: Network attempt (should be blocked) ===');
  const r5 = await cs.maybeExecute('```python\nimport urllib.request\ntry:\n    urllib.request.urlopen("https://example.com", timeout=2)\n    print("NETWORK: reachable")\nexcept Exception as e:\n    print(f"NETWORK: blocked ({type(e).__name__})")\n```');
  if (r5.executed && r5.result) {
    console.log(`  exit=${r5.result.exitCode}`);
    console.log(`  stdout: ${r5.result.stdout.trim()}`);
  }

  // ── Test 6: Timeout enforcement ──
  console.log('\n=== Test 6: Timeout enforcement ===');
  const r6 = await cs.maybeExecute('```python\nimport time\ntime.sleep(60)\nprint("this should never print")\n```', { autoApprove: true });
  if (r6.executed && r6.result) {
    console.log(`  exit=${r6.result.exitCode} timedOut=${r6.result.timedOut} dur=${r6.result.durationMs}ms`);
  }

  // ── Audit log ──
  console.log('\n=== Audit log (last 6 executions) ===');
  for (const r of cs.getLog(6)) {
    console.log(`  [${new Date(r.timestamp).toISOString().slice(11, 19)}] lang=${r.language} exit=${r.exitCode} dur=${r.durationMs}ms constitution=${r.constitutionTriggered} rules=${r.triggeredRules.join(',') || '-'}`);
  }
})();
