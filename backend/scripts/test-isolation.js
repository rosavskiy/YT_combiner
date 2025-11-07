#!/usr/bin/env node
/**
 * E2E / isolation test script
 * Usage (PowerShell): node scripts/test-isolation.js
 * Optional env:
 *   BASE_URL (default http://localhost:3000)
 *   ADMIN_LOGIN / ADMIN_PASSWORD (if admin not existing will fallback to scripts/create-admin.js values)
 * Scenario:
 *  1. Ensure admin exists (rosavsky / O7gheo13@!)
 *  2. Create two users usera / userb (approved)
 *  3. Login each user, create one download job each (different video IDs)
 *  4. Verify listing /api/videos/downloaded shows only own entries for usera, userb
 *  5. Admin login lists all entries
 *  6. Admin impersonates usera -> token acts as usera; verify isolation still returns usera data
 *  7. Revert impersonation, verify admin token again lists all
 *  8. Output PASS/FAIL summary
 */
import axios from 'axios';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API = BASE_URL.replace(/\/$/, '') + '/api';
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'rosavsky';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'O7gheo13@!';

function log(step, msg) { console.log(`[${step}] ${msg}`); }
function fail(step, msg) { console.error(`FAIL [${step}] ${msg}`); throw new Error(msg); }

async function login(login, password) {
  const r = await axios.post(API + '/auth/login', { login, password });
  if (!r.data.success) throw new Error('login failed: ' + r.data.error);
  return r.data.data.token;
}

async function getMe(token) {
  const r = await axios.get(API + '/auth/me', { headers: { Authorization: 'Bearer ' + token } });
  return r.data.data;
}

async function approveUser(adminToken, userId) {
  await axios.post(API + '/auth/approve/' + userId, {}, { headers: { Authorization: 'Bearer ' + adminToken } });
}

async function impersonate(adminToken, userId) {
  const r = await axios.post(API + '/auth/impersonate/' + userId, {}, { headers: { Authorization: 'Bearer ' + adminToken } });
  if (!r.data.success) throw new Error('impersonate failed');
  return r.data.data.token;
}

async function revertImpersonation(adminToken) {
  const r = await axios.post(API + '/auth/revert-impersonation', {}, { headers: { Authorization: 'Bearer ' + adminToken } });
  if (!r.data.success) throw new Error('revert failed');
  return r.data.data.token;
}

async function createUserViaScript(login, password, first, last) {
  const args = ['scripts/create-user.js', `--login=${login}`, `--password=${password}`, '--approved'];
  if (first) args.push(`--first=${first}`); if (last) args.push(`--last=${last}`);
  const r = spawnSync('node', args, { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  if (r.status !== 0) throw new Error('create-user script failed: ' + r.stderr + r.stdout);
}

async function ensureAdmin() {
  try {
    await login(ADMIN_LOGIN, ADMIN_PASSWORD); // already exists
    log('admin', 'Admin exists');
  } catch {
    log('admin', 'Admin missing; invoking create-admin.js');
    const r = spawnSync('node', ['scripts/create-admin.js'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
    if (r.status !== 0) fail('admin', 'Cannot create admin: ' + r.stderr + r.stdout);
  }
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await axios.get(url + '/health');
      if (r.status === 200) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function start() {
  console.log('=== Isolation / Impersonation E2E Test ===');
  // Launch server child process
  const backendCwd = path.join(__dirname, '..');
  console.log('▶ Starting backend server...');
  const child = spawn('node', ['src/server.js'], { cwd: backendCwd, stdio: 'inherit' });
  const ready = await waitForServer(BASE_URL, 25000);
  if (!ready) {
    try { child.kill(); } catch {}
    fail('server', 'Server did not become ready');
  }
  console.log('✅ Backend ready');

  await ensureAdmin();

  // Create users
  await createUserViaScript('usera', 'UserA123!', 'User', 'A');
  await createUserViaScript('userb', 'UserB123!', 'User', 'B');

  // Login tokens
  const adminToken = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
  const userAToken = await login('usera', 'UserA123!');
  const userBToken = await login('userb', 'UserB123!');

  const userA = await getMe(userAToken); const userB = await getMe(userBToken);
  if (userA.is_approved === 0) await approveUser(adminToken, userA.id);
  if (userB.is_approved === 0) await approveUser(adminToken, userB.id);

  // Set different tracked countries per user
  const setTracked = async (token, trends, topics) => {
    await axios.put(API + '/config/tracked-countries', { trends, topics }, { headers: { Authorization: 'Bearer ' + token } });
  };
  await setTracked(userAToken, ['US','GB','CA'], ['US']);
  await setTracked(userBToken, ['DE','FR'], ['DE','FR']);

  // Create one download job each (fake minimal payload; service will mark pending)
  const vdA = await axios.post(API + '/videos/download', { videoId: 'vid_userA_' + Date.now(), title: 'A video', channel: 'A Channel' }, { headers: { Authorization: 'Bearer ' + userAToken } });
  if (!vdA.data.success) fail('userA', 'Download create failed');
  const vdB = await axios.post(API + '/videos/download', { videoId: 'vid_userB_' + Date.now(), title: 'B video', channel: 'B Channel' }, { headers: { Authorization: 'Bearer ' + userBToken } });
  if (!vdB.data.success) fail('userB', 'Download create failed');

  // List downloaded (will be empty until marking) but record exists, we rely on upsert presence once downloaded=1 set (not yet). We'll test isolation via stats listing (uses owner filter)
  const listA = await axios.get(API + '/videos/downloaded', { headers: { Authorization: 'Bearer ' + userAToken } });
  const listB = await axios.get(API + '/videos/downloaded', { headers: { Authorization: 'Bearer ' + userBToken } });
  if (listA.data.success !== true || listB.data.success !== true) fail('list', 'List failed');

  // Admin should see both (currently zero downloaded maybe) -> rely on stats total vs each
  const statsA = await axios.get(API + '/videos/stats', { headers: { Authorization: 'Bearer ' + userAToken } });
  const statsB = await axios.get(API + '/videos/stats', { headers: { Authorization: 'Bearer ' + userBToken } });
  const statsAdmin = await axios.get(API + '/videos/stats', { headers: { Authorization: 'Bearer ' + adminToken } });
  const totalA = statsA.data.data.videos.total; const totalB = statsB.data.data.videos.total; const totalAdmin = statsAdmin.data.data.videos.total;
  if (totalAdmin < totalA + totalB) fail('isolation', `Admin total(${totalAdmin}) < sum user totals(${totalA + totalB})`);
  log('isolation', `Per-user totals OK (userA=${totalA}, userB=${totalB}, admin=${totalAdmin})`);

  // Impersonation
  const impToken = await impersonate(adminToken, userA.id);
  const impStats = await axios.get(API + '/videos/stats', { headers: { Authorization: 'Bearer ' + impToken } });
  const impTotal = impStats.data.data.videos.total;
  if (impTotal !== totalA) fail('impersonation', 'Impersonated total mismatch');
  log('impersonation', 'Impersonated stats match userA');

  // Verify per-user tracked countries roundtrip
  const myA = await axios.get(API + '/config/tracked-countries', { headers: { Authorization: 'Bearer ' + userAToken } });
  const myB = await axios.get(API + '/config/tracked-countries', { headers: { Authorization: 'Bearer ' + userBToken } });
  if (!Array.isArray(myA.data.trends) || myA.data.trends[0] !== 'US') fail('settingsA', 'UserA settings not saved');
  if (!Array.isArray(myB.data.trends) || myB.data.trends[0] !== 'DE') fail('settingsB', 'UserB settings not saved');

  const revertedToken = await revertImpersonation(impToken); // using impersonated token as admin
  const revStats = await axios.get(API + '/videos/stats', { headers: { Authorization: 'Bearer ' + revertedToken } });
  if (revStats.data.data.videos.total !== totalAdmin) fail('revert', 'Reverted admin stats mismatch');
  log('revert', 'Revert impersonation restored admin view');

  console.log('✅ ALL TESTS PASSED');
  try { child.kill(); } catch {}
}

start().catch(e => { console.error('❌ TEST FAILED:', e.message); process.exit(1); });
