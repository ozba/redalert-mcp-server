import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = 'C:/redAlert';
const SERVER_PATH = resolve(PROJECT_ROOT, 'dist/index.js');
const REST_PLAN_PATH = resolve(PROJECT_ROOT, 'e2e/rest-test-plan.json');
const REALTIME_PLAN_PATH = resolve(PROJECT_ROOT, 'e2e/realtime-test-plan.json');
const RESULTS_PATH = resolve(PROJECT_ROOT, 'e2e/results.json');

const API_KEY = 'mcpoJDEwCBjfiNjPgSMifQIiErLBeybAEQcBzkZshNpYuqSKeheviXVedazVVxvSobL';

let requestId = 1;
let responseBuffer = '';
const pendingRequests = new Map();

function nextId() {
  return requestId++;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function spawnServer() {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn('node', [SERVER_PATH], {
      env: { ...process.env, REDALERT_API_KEY: API_KEY },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stderr.on('data', (data) => {
      // Log server stderr for debugging but don't process it
      const msg = data.toString().trim();
      if (msg) console.error(`[server stderr] ${msg}`);
    });

    proc.stdout.on('data', (data) => {
      responseBuffer += data.toString();
      // Process line-delimited JSON
      let newlineIdx;
      while ((newlineIdx = responseBuffer.indexOf('\n')) !== -1) {
        const line = responseBuffer.slice(0, newlineIdx).trim();
        responseBuffer = responseBuffer.slice(newlineIdx + 1);
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          const id = parsed.id;
          if (id !== undefined && pendingRequests.has(id)) {
            const { resolve: res } = pendingRequests.get(id);
            pendingRequests.delete(id);
            res(parsed);
          }
        } catch (e) {
          console.error(`[parse error] Could not parse: ${line}`);
        }
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.on('exit', (code) => {
      // Reject all pending requests
      for (const [id, { reject: rej }] of pendingRequests) {
        rej(new Error(`Server exited with code ${code}`));
      }
      pendingRequests.clear();
    });

    // Give server a moment to start
    setTimeout(() => resolvePromise(proc), 500);
  });
}

function sendRequest(proc, method, params) {
  const id = nextId();
  const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  proc.stdin.write(msg + '\n');

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request ${id} (${method}) timed out after 30s`));
    }, 30000);

    pendingRequests.set(id, {
      resolve: (data) => {
        clearTimeout(timeout);
        resolve(data);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });
  });
}

function sendNotification(proc, method, params) {
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
  proc.stdin.write(msg + '\n');
}

async function initialize(proc) {
  const resp = await sendRequest(proc, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'e2e-test-runner', version: '1.0.0' },
  });
  console.log('[init] Server initialized:', JSON.stringify(resp.result?.serverInfo || {}));
  sendNotification(proc, 'notifications/initialized', {});
  await delay(200);
  return resp;
}

async function callTool(proc, toolName, args) {
  return sendRequest(proc, 'tools/call', {
    name: toolName,
    arguments: args || {},
  });
}

function validateResult(response, testCase) {
  const result = { testId: testCase.id, tool: testCase.tool, description: testCase.description };
  const errors = [];

  // Check if the response itself is an error
  if (response.error) {
    if (testCase.validate.isError) {
      result.pass = true;
      result.detail = `Expected error, got: ${response.error.message}`;
      return result;
    } else {
      result.pass = false;
      result.detail = `Unexpected JSON-RPC error: ${JSON.stringify(response.error)}`;
      return result;
    }
  }

  const toolResult = response.result;
  if (!toolResult) {
    result.pass = false;
    result.detail = 'No result in response';
    return result;
  }

  // Check isError on the tool result
  const isError = toolResult.isError === true;
  if (testCase.validate.isError && !isError) {
    errors.push(`Expected isError=true but got isError=${isError}`);
  } else if (!testCase.validate.isError && isError) {
    errors.push(`Expected isError=false but got isError=true. Content: ${JSON.stringify(toolResult.content)}`);
  }

  // Try to parse content as JSON
  let contentText = '';
  let parsedContent = null;
  if (toolResult.content && Array.isArray(toolResult.content)) {
    contentText = toolResult.content.map(c => c.text || '').join('');
  } else if (typeof toolResult.content === 'string') {
    contentText = toolResult.content;
  }

  if (testCase.validate.responseIsJSON) {
    try {
      parsedContent = JSON.parse(contentText);
    } catch (e) {
      errors.push(`Expected JSON response but failed to parse: ${contentText.slice(0, 200)}`);
    }
  }

  // Check requiredFields
  if (parsedContent && testCase.validate.requiredFields) {
    for (const field of testCase.validate.requiredFields) {
      if (!(field in parsedContent)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Check fieldChecks
  if (parsedContent && testCase.validate.fieldChecks) {
    for (const [field, expected] of Object.entries(testCase.validate.fieldChecks)) {
      const actual = parsedContent[field];
      if (actual !== expected) {
        errors.push(`Field "${field}": expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    }
  }

  // Check arrayChecks
  if (parsedContent && testCase.validate.arrayChecks) {
    for (const [field, checks] of Object.entries(testCase.validate.arrayChecks)) {
      const arr = parsedContent[field];
      if (!Array.isArray(arr)) {
        errors.push(`Field "${field}" is not an array: ${JSON.stringify(arr)}`);
        continue;
      }
      if (checks.exactMatch) {
        const expected = JSON.stringify([...checks.exactMatch].sort());
        const actual = JSON.stringify([...arr].sort());
        if (expected !== actual) {
          errors.push(`Array "${field}": expected ${expected}, got ${actual}`);
        }
      }
    }
  }

  result.pass = errors.length === 0;
  result.detail = errors.length > 0 ? errors.join('; ') : 'OK';
  result.rawContent = contentText.slice(0, 500);
  return result;
}

async function runRestTests(proc) {
  const plan = JSON.parse(readFileSync(REST_PLAN_PATH, 'utf-8'));
  const results = [];

  console.log(`\n=== REST API Tests (${plan.testCases.length} cases) ===\n`);

  for (const tc of plan.testCases) {
    process.stdout.write(`  [${tc.id}] ${tc.tool} - ${tc.description} ... `);
    try {
      const response = await callTool(proc, tc.tool, tc.arguments);
      const result = validateResult(response, tc);
      results.push(result);
      console.log(result.pass ? 'PASS' : `FAIL: ${result.detail}`);
    } catch (err) {
      const result = {
        testId: tc.id,
        tool: tc.tool,
        description: tc.description,
        pass: false,
        detail: `Exception: ${err.message}`,
      };
      results.push(result);
      console.log(`FAIL: ${result.detail}`);
    }
  }

  return results;
}

async function runRealtimeTests(proc) {
  const plan = JSON.parse(readFileSync(REALTIME_PLAN_PATH, 'utf-8'));
  const results = [];

  // Group tests by sequence
  const sequences = new Map();
  for (const tc of plan.tests) {
    if (!sequences.has(tc.sequence)) {
      sequences.set(tc.sequence, []);
    }
    sequences.get(tc.sequence).push(tc);
  }

  // Sort sequences by sequence number
  const sortedSeqs = [...sequences.entries()].sort((a, b) => a[0] - b[0]);

  console.log(`\n=== Real-time Tests (${plan.tests.length} cases in ${sortedSeqs.length} sequences) ===\n`);

  for (const [seqNum, tests] of sortedSeqs) {
    const seqInfo = plan.sequences.find(s => s.id === `seq-${seqNum}`);
    console.log(`  --- Sequence ${seqNum}: ${seqInfo?.name || 'Unknown'} ---`);

    // Sort by step
    tests.sort((a, b) => a.step - b.step);

    for (const tc of tests) {
      // Handle delay before step
      if (tc.delayBeforeMs) {
        process.stdout.write(`    (waiting ${tc.delayBeforeMs}ms) `);
        await delay(tc.delayBeforeMs);
      }

      // Add 3-second delay after subscribe_alerts
      const isSubscribe = tc.tool === 'subscribe_alerts';

      process.stdout.write(`  [${tc.id}] ${tc.tool} - ${tc.description} ... `);
      try {
        const response = await callTool(proc, tc.tool, tc.arguments);
        const result = validateResult(response, tc);
        results.push(result);
        console.log(result.pass ? 'PASS' : `FAIL: ${result.detail}`);

        if (isSubscribe && result.pass) {
          process.stdout.write('    (waiting 3s for connection to establish) ');
          await delay(3000);
          console.log('done');
        }
      } catch (err) {
        const result = {
          testId: tc.id,
          tool: tc.tool,
          description: tc.description,
          pass: false,
          detail: `Exception: ${err.message}`,
        };
        results.push(result);
        console.log(`FAIL: ${result.detail}`);
      }
    }
    console.log('');
  }

  return results;
}

async function main() {
  console.log('Starting E2E test run...');
  console.log(`Server: ${SERVER_PATH}`);
  console.log(`REST plan: ${REST_PLAN_PATH}`);
  console.log(`Realtime plan: ${REALTIME_PLAN_PATH}`);

  let proc;
  try {
    proc = await spawnServer();
    console.log('Server spawned, initializing...');

    await initialize(proc);

    const restResults = await runRestTests(proc);
    const realtimeResults = await runRealtimeTests(proc);

    const allResults = [...restResults, ...realtimeResults];
    const passed = allResults.filter(r => r.pass).length;
    const failed = allResults.filter(r => !r.pass).length;
    const total = allResults.length;

    const summary = {
      timestamp: new Date().toISOString(),
      total,
      passed,
      failed,
      passRate: `${((passed / total) * 100).toFixed(1)}%`,
      restResults,
      realtimeResults,
      failures: allResults.filter(r => !r.pass),
    };

    writeFileSync(RESULTS_PATH, JSON.stringify(summary, null, 2));

    console.log('\n========== SUMMARY ==========');
    console.log(`Total:  ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Rate:   ${summary.passRate}`);
    if (failed > 0) {
      console.log('\nFailures:');
      for (const f of summary.failures) {
        console.log(`  - [${f.testId}] ${f.tool}: ${f.detail}`);
      }
    }
    console.log(`\nResults written to: ${RESULTS_PATH}`);

    // Kill server
    proc.stdin.end();
    proc.kill('SIGTERM');
    await delay(1000);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error:', err);
    if (proc) {
      proc.kill('SIGTERM');
    }
    process.exit(2);
  }
}

main();
