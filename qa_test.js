import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000';

const request = (method, endpoint, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody);
            resolve({ status: res.statusCode, data: parsed });
          } catch {
            resolve({ status: res.statusCode, raw: responseBody });
          }
        });
      }
    );

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
};

const runQA = async () => {
  console.log('--- Starting QA Test Suite for Personal Finance Tracker API ---');
  let passed = 0;
  let failed = 0;

  const assert = (condition, name, details = '') => {
    if (condition) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      console.error(`FAIL: ${name} ${details}`);
      failed++;
    }
  };

  // Start backend server
  const serverProcess = spawn('node', ['src/server.js'], {
    cwd: __dirname,
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', (d) => console.log(`[SERVER]: ${d.toString().trim()}`));
  serverProcess.stderr.on('data', (d) => console.error(`[SERVER ERR]: ${d.toString().trim()}`));

  // Wait for server to start
  await new Promise((r) => setTimeout(r, 2000));

  try {
    // 1. Health check
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.data?.status === 'ok', '1. GET /api/health');

    // 2. Register
    const email = `testuser_${Date.now()}@example.com`;
    const regRes = await request('POST', '/api/auth/register', {
      name: 'QA Tester',
      email,
      password: 'password123'
    });
    assert(regRes.status === 201 && regRes.data?.data?.token, '2. POST /api/auth/register', JSON.stringify(regRes.data));
    const token = regRes.data?.data?.token;

    // 3. Login
    const loginRes = await request('POST', '/api/auth/login', {
      email,
      password: 'password123'
    });
    assert(loginRes.status === 200 && loginRes.data?.data?.token, '3. POST /api/auth/login');

    // 4. Auth Me
    const meRes = await request('GET', '/api/auth/me', null, token);
    assert(meRes.status === 200 && meRes.data?.data?.user?.email === email, '4. GET /api/auth/me');

    // 5. Categories
    const catRes = await request('GET', '/api/categories');
    assert(
      catRes.status === 200 &&
      Array.isArray(catRes.data?.data?.income) &&
      Array.isArray(catRes.data?.data?.expense),
      '5. GET /api/categories'
    );

    // 6. Create Income Transaction
    const incTxRes = await request('POST', '/api/transactions', {
      type: 'income',
      category: 'Salary',
      amount: 5000,
      date: '2026-11-01',
      note: 'November Salary'
    }, token);
    assert(incTxRes.status === 201 && incTxRes.data?.data?.amount === 5000, '6. POST /api/transactions (Income)');

    // 7. Create Expense Transaction
    const expTxRes = await request('POST', '/api/transactions', {
      type: 'expense',
      category: 'Food',
      amount: 450,
      date: '2026-11-02',
      note: 'Grocery store'
    }, token);
    assert(expTxRes.status === 201 && expTxRes.data?.data?.amount === 450, '7. POST /api/transactions (Expense)');
    const expId = expTxRes.data?.data?.id;

    // 8. Get Transactions List
    const txListRes = await request('GET', '/api/transactions?page=1&limit=10', null, token);
    assert(
      txListRes.status === 200 &&
      txListRes.data?.data?.items?.length >= 2 &&
      txListRes.data?.data?.total >= 2,
      '8. GET /api/transactions'
    );

    // 9. Set Budget
    const budgetRes = await request('PUT', '/api/budgets', {
      month: '2026-11',
      category: 'Food',
      limit: 1000
    }, token);
    assert(
      budgetRes.status === 200 &&
      budgetRes.data?.data?.limit === 1000 &&
      budgetRes.data?.data?.spent === 450 &&
      budgetRes.data?.data?.percentUsed === 45,
      '9. PUT /api/budgets (Compute spent and percentUsed)',
      JSON.stringify(budgetRes.data)
    );
    const budgetId = budgetRes.data?.data?.id;

    // 10. Get Budgets
    const getBudgetsRes = await request('GET', '/api/budgets?month=2026-11', null, token);
    assert(
      getBudgetsRes.status === 200 &&
      getBudgetsRes.data?.data?.some((b) => b.category === 'Food'),
      '10. GET /api/budgets?month=2026-11'
    );

    // 11. Stats Summary
    const summaryRes = await request('GET', '/api/stats/summary?from=2026-11-01&to=2026-11-30', null, token);
    assert(
      summaryRes.status === 200 &&
      summaryRes.data?.data?.totalIncome === 5000 &&
      summaryRes.data?.data?.totalExpense === 450 &&
      summaryRes.data?.data?.balance === 4550,
      '11. GET /api/stats/summary',
      JSON.stringify(summaryRes.data)
    );

    // 12. Stats By Category
    const byCatRes = await request('GET', '/api/stats/by-category?from=2026-11-01&to=2026-11-30&type=expense', null, token);
    assert(
      byCatRes.status === 200 &&
      byCatRes.data?.data?.length > 0 &&
      byCatRes.data?.data[0].category === 'Food',
      '12. GET /api/stats/by-category'
    );

    // 13. Monthly Stats
    const monthlyRes = await request('GET', '/api/stats/monthly?year=2026', null, token);
    const novStats = monthlyRes.data?.data?.find((m) => m.month === 'Nov');
    assert(
      monthlyRes.status === 200 &&
      novStats &&
      novStats.income === 5000 &&
      novStats.expense === 450,
      '13. GET /api/stats/monthly',
      JSON.stringify(novStats)
    );

    // 14. Delete Transaction
    const delTxRes = await request('DELETE', `/api/transactions/${expId}`, null, token);
    assert(delTxRes.status === 200 && delTxRes.data?.data?.success === true, '14. DELETE /api/transactions/:id');

    // 15. Delete Budget
    const delBudgetRes = await request('DELETE', `/api/budgets/${budgetId}`, null, token);
    assert(delBudgetRes.status === 200 && delBudgetRes.data?.data?.success === true, '15. DELETE /api/budgets/:id');

    // 16. Unauthorized Check
    const unauthRes = await request('GET', '/api/transactions');
    assert(unauthRes.status === 401, '16. Unauthorized protection without token');

    console.log(`\nQA Result: ${passed} passed, ${failed} failed.`);
  } finally {
    serverProcess.kill();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runQA().catch((err) => {
  console.error('QA script execution failed:', err);
  process.exit(1);
});

