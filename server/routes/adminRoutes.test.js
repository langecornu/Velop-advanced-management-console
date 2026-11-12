import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { createApp } from '../app.js';
import { createMockRouter } from '../services/mockRouter.js';

let server;
let baseUrl;
let router;
let directory;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'velop-admin-'));
  router = createMockRouter({
    'routerleds/GetRouterLEDSettings': { isSwitchportLEDEnabled: false },
    'wirelessap/GetRadioInfo': {
      radios: [
        {
          radioID: 'R5',
          band: '5GHz',
          settings: {
            isEnabled: true,
            ssid: 'home',
            security: 'WPA2-Personal',
            wpaPersonalSettings: { passphrase: 'old-password' },
          },
        },
      ],
    },
  });
  const app = createApp({ client: router, config: { allowedOrigin: 'http://localhost:5173', dataDir: directory } });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/admin`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
});

function post(path, body, headers = { 'X-Velop-Tool': '1' }) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('a write without the X-Velop-Tool header is refused before it reaches the router', async () => {
  const response = await post('/controls/leds', { value: true }, {});
  assert.equal(response.status, 403);
  assert.equal(router.writes.length, 0);
});

test('a Wi-Fi change without the exact confirmation phrase is rejected and changes nothing', async () => {
  const response = await post('/wifi', { ssid: 'hacked', confirm: 'yes' });
  assert.equal(response.status, 400);
  assert.equal(router.writes.length, 0);
});

test('a restart without the exact confirmation phrase is rejected and does not restart', async () => {
  const response = await post('/reboot', { confirm: 'restart' });
  assert.equal(response.status, 400);
  assert.equal(
    router.writes.some((item) => item.action === 'core/Reboot'),
    false,
  );
});

test('unknown fields in a request are rejected rather than ignored', async () => {
  const response = await post('/controls/leds', { value: true, sneaky: 1 });
  assert.equal(response.status, 400);
});

test('a valid switch change works end to end and lands in the backup list', async () => {
  const response = await post('/controls/leds', { value: true });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).value, true);
  const listing = await (await fetch(`${baseUrl}/backups`)).json();
  assert.equal(listing.backups.length, 1);
  assert.equal(JSON.stringify(listing).includes('payload'), false, 'a listing must not expose snapshot contents');
});

test('the Wi-Fi view never contains a password, and a confirmed change succeeds', async () => {
  const view = await (await fetch(`${baseUrl}/wifi`)).text();
  assert.equal(view.includes('old-password'), false);
  const response = await post('/wifi', { ssid: 'newname', passphrase: 'a-new-password', confirm: 'CHANGE WI-FI' });
  assert.equal(response.status, 200);
  assert.equal((await response.text()).includes('a-new-password'), false, 'the response must not echo the password');
});

test('restoring a backup needs confirmation and rejects path tricks', async () => {
  assert.equal((await post('/backups/x.json/restore', {})).status, 400);
  assert.equal((await post('/backups/..%2F..%2Fsecret.json/restore', { confirm: true })).status, 400);
});

test('the new write routes all refuse a request without the exact confirmation, and touch nothing', async () => {
  const before = router.writes.length;
  const rule = {
    isEnabled: true,
    externalPort: 8080,
    protocol: 'TCP',
    internalIp: '192.168.1.5',
    internalPort: 80,
    description: 'x',
  };
  assert.equal((await post('/devices/delete', { deviceIds: ['1'], confirm: 'yes' })).status, 400);
  assert.equal((await post('/port-forwarding', { ...rule, confirm: false })).status, 400);
  assert.equal((await post('/port-forwarding', rule)).status, 400, 'a missing confirmation is refused too');
  assert.equal((await post('/speedtest', {})).status, 400);
  assert.equal((await post('/nodes/update', { confirm: 'update' })).status, 400);
  assert.equal(router.writes.length, before);
});

test('switching firmware updates to manual needs confirmation, because it leaves the router unpatched', async () => {
  const response = await post('/schedules/firmware', { policy: 'Manual', startMinute: 0, durationMinutes: 240 });
  assert.equal(response.status, 409);
});

test('unknown fields and oversized lists are rejected on the device routes', async () => {
  assert.equal((await post('/devices/x/rename', { name: 'ok', extra: 1 })).status, 400);
  const ids = Array.from({ length: 201 }, (_, index) => String(index));
  assert.equal((await post('/devices/delete', { deviceIds: ids, confirm: 'DELETE DEVICES' })).status, 400);
});

test('responses carry no header that forces HTTPS, so the tool works over plain HTTP from other devices', async () => {
  const response = await fetch(`${baseUrl.replace('/admin', '')}/health`);
  const policy = response.headers.get('content-security-policy') ?? '';
  assert.equal(policy.includes('upgrade-insecure-requests'), false);
  assert.equal(response.headers.get('strict-transport-security'), null);
  assert.match(policy, /default-src 'self'/, 'the rest of the policy stays in place');
});
