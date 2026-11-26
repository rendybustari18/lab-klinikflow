import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import mysql from '../bun-api/node_modules/mysql2/promise.js';

const base = process.env.KLINIKFLOW_TEST_BASE;
const phpBase = process.env.KLINIKFLOW_TEST_PHP_BASE;
const database = process.env.KLINIKFLOW_TEST_DB_NAME;
if (process.env.KLINIKFLOW_TEST_DISPOSABLE !== '1' || !base || !phpBase || !database) {
  throw new Error('Gunakan hanya database uji sekali pakai; tetapkan KLINIKFLOW_TEST_DISPOSABLE, KLINIKFLOW_TEST_BASE, dan KLINIKFLOW_TEST_PHP_BASE');
}

async function request(path, { session, method = 'GET', body, csrf = true, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (session) {
    requestHeaders.Cookie = session.cookie;
    if (csrf) requestHeaders['X-CSRF-Token'] = session.csrf;
  }
  const response = await fetch(`${base}${path}`, {
    method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, data: await response.json() };
}

async function login(email, password = 'password123') {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.token, undefined);
  const cookies = result.response.headers.getSetCookie();
  const sessionCookie = cookies.find(cookie => cookie.startsWith('klinikflow_session='));
  const csrfCookie = cookies.find(cookie => cookie.startsWith('klinikflow_csrf='));
  assert.ok(sessionCookie?.includes('HttpOnly'));
  assert.ok(sessionCookie?.includes('SameSite=Strict'));
  assert.ok(csrfCookie);
  return {
    cookie: `${sessionCookie.split(';')[0]}; ${csrfCookie.split(';')[0]}`,
    csrf: csrfCookie.split(';')[0].split('=')[1],
  };
}

test('security regression against an isolated seeded lab database', async () => {
  for (const path of ['/api/patients', '/api/visits', '/api/invoices', '/api/claims', '/api/attachments', '/api/reports', '/api/staff/invitations']) {
    assert.equal((await request(path)).response.status, 401, path);
  }
  for (const path of ['/api/patients', '/api/visits', '/api/payments/process', '/api/claims/approve', '/api/reports/export']) {
    assert.equal((await request(path, { method: 'POST', body: {} })).response.status, 401, path);
  }
  assert.equal((await request('/api/auth/login', { method: 'POST', body: {}, headers: { Origin: 'https://attacker.example' } })).response.status, 403);
  const directPhp = await fetch(`${phpBase}/claims.php?action=list`, { headers: { 'X-User-Role': 'admin', 'X-Clinic-Id': '1', 'X-User-Id': '1' } });
  assert.equal(directPhp.status, 401);

  const manager = await login('manager@klinikflow.local');
  const staffOtherClinic = await login('staf2@klinikflow.local');
  const cashier = await login('kasir1@klinikflow.local');
  const patient = await login('pasien1@pasien.local');
  assert.equal((await request('/api/patients', { session: patient })).response.status, 403);
  assert.equal((await request('/api/dashboard/stats', { session: patient })).response.status, 403);
  assert.equal((await request('/api/services/fee', { session: staffOtherClinic, method: 'POST', body: { id: 1, fee: 1 } })).response.status, 403);
  assert.equal((await request('/api/services/fee', { session: manager, method: 'POST', body: { id: 6, fee: 1 } })).response.status, 404);
  assert.equal((await request('/api/services/fee', { session: manager, method: 'POST', body: { id: 1, fee: 1 }, csrf: false })).response.status, 403);
  assert.equal((await request('/api/services/fee', { session: manager, method: 'POST', body: { id: 1, fee: '123junk' } })).response.status, 400);
  assert.equal((await request('/api/services/fee', { session: manager, method: 'POST', body: { id: 1, fee: 88000 } })).response.status, 200);
  assert.equal((await request('/api/visits', { session: staffOtherClinic, method: 'POST', body: { patient_id: 1, clinic_id: 1 } })).response.status, 404);
  assert.equal((await request('/api/visits/vis-9a1b-c1d2e3f4-0001', { session: staffOtherClinic })).response.status, 404);
  assert.equal((await request('/api/invoices/6', { session: cashier })).response.status, 404);
  assert.equal((await request('/api/claims/4', { session: manager })).response.status, 404);
  assert.equal((await request('/api/attachments/att-e5d6-7c8b-0004', { session: manager })).response.status, 404);

  for (const path of ['/api/patients', '/api/visits', '/api/invoices', '/api/claims', '/api/attachments', '/api/reports', '/api/staff']) {
    const result = await request(path, { session: manager });
    assert.equal(result.response.status, 200, `${path}: ${JSON.stringify(result.data)}`);
    assert.ok(result.data.data.every(row => !row.clinic_id || Number(row.clinic_id) === 1), path);
  }
  const dashboard = await request('/api/dashboard/stats', { session: manager });
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.data.data.total_patients, 2);
  assert.ok(dashboard.data.data.recent_visits.every(row => Number(row.clinic_id) === 1));
  const attachment = await request('/api/attachments/att-f1a2-3b4c-0001', { session: manager });
  assert.equal(attachment.response.status, 200);
  assert.equal(attachment.data.data.file_path, undefined);
  const exportResult = await request('/api/reports/export', { session: manager, method: 'POST', body: { type: 'daily_financial', format: 'text', filter: 'all' } });
  assert.equal(exportResult.response.status, 200, JSON.stringify(exportResult.data));
  assert.equal((await request('/api/reports/export', { session: manager, method: 'POST', body: { type: 'daily_financial', format: 'text;id', filter: 'all' } })).response.status, 400);

  const paymentId = randomUUID();
  const paymentBody = { invoice_id: 4, amount: 150000, method: 'cash', request_id: paymentId };
  assert.equal((await request('/api/payments/process', { session: cashier, method: 'POST', body: { ...paymentBody, amount: 1 } })).response.status, 400);
  const payments = await Promise.all([1, 2].map(() => request('/api/payments/process', { session: cashier, method: 'POST', body: paymentBody })));
  assert.ok(payments.every(result => result.response.status === 200), JSON.stringify(payments.map(result => result.data)));
  assert.equal(payments[0].data.payment_ref, payments[1].data.payment_ref);
  assert.equal((await request('/api/payments/process', { session: cashier, method: 'POST', body: { ...paymentBody, request_id: randomUUID() } })).response.status, 409);
  const invoice = await request('/api/invoices/4', { session: cashier });
  assert.equal(invoice.data.data.payments.length, 1);

  assert.equal((await request('/api/claims/approve', { session: cashier, method: 'POST', body: { claim_id: 2 } })).response.status, 403);
  const db = await mysql.createConnection({
    host: process.env.KLINIKFLOW_TEST_DB_HOST, port: Number(process.env.KLINIKFLOW_TEST_DB_PORT),
    user: process.env.KLINIKFLOW_TEST_DB_USER, password: process.env.KLINIKFLOW_TEST_DB_PASSWORD, database,
  });
  await db.execute('UPDATE claims SET amount = 165000 WHERE id = 2');
  assert.equal((await request('/api/claims/approve', { session: manager, method: 'POST', body: { claim_id: 2 } })).response.status, 409);
  const [fixture] = await db.execute(
    "INSERT INTO claims (claim_uuid, clinic_id, invoice_id, claim_number, insurance_name, amount, status) VALUES (?, 1, 3, ?, 'Test insurance', 75000, 'submitted')",
    [randomUUID(), `TEST-${randomUUID()}`]
  );
  await db.end();
  const approved = await request('/api/claims/approve', { session: manager, method: 'POST', body: { claim_id: fixture.insertId } });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.data));
  assert.equal((await request('/api/claims/approve', { session: manager, method: 'POST', body: { claim_id: fixture.insertId } })).response.status, 409);

  const invite = await request('/api/staff/invitations', { session: manager, method: 'POST', body: { email: 'new-staff@test.local', role: 'staff' } });
  assert.equal(invite.response.status, 200, JSON.stringify(invite.data));
  assert.match(invite.data.token, /^[a-f0-9]{64}$/);
  const invitations = await request('/api/staff/invitations', { session: manager });
  assert.ok(invitations.data.data.every(row => row.token === undefined));
  const accept = { token: invite.data.token, name: 'Staf Baru', password: 'strong-test-password' };
  assert.equal((await request('/api/staff/accept-invitation', { method: 'POST', body: { ...accept, role: 'admin' } })).response.status, 400);
  const accepted = await request('/api/staff/accept-invitation', { method: 'POST', body: accept });
  assert.equal(accepted.response.status, 200, JSON.stringify(accepted.data));
  assert.equal(accepted.data.assigned_role, 'staff');
  assert.equal((await request('/api/staff/accept-invitation', { method: 'POST', body: accept })).response.status, 404);
  const newStaff = await login('new-staff@test.local', accept.password);
  assert.equal((await request('/api/staff', { session: newStaff })).response.status, 403);

  for (const file of ['../web/src/views/Patients.vue', '../web/src/views/Reports.vue']) {
    assert.doesNotMatch(await readFile(new URL(file, import.meta.url), 'utf8'), /v-html/);
  }
  assert.equal((await request('/api/auth/logout', { session: manager, method: 'POST', body: {} })).response.status, 200);
  assert.equal((await request('/api/auth/me', { session: manager })).response.status, 401);
});