import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deriveStatus } from './status.js';

const UP = { reachable: true, rttMs: 12 };
const DOWN = { reachable: false, rttMs: null };

test('router online and ping answered is plainly Online', () => {
  assert.equal(deriveStatus({ ip: '192.168.1.5', isOnline: true }, UP).key, 'online');
});

test('router offline but ping answered is Online and explains why', () => {
  const status = deriveStatus({ ip: '192.168.1.117', isOnline: false }, UP);
  assert.equal(status.key, 'verified');
  assert.equal(status.isUp, true);
  assert.match(status.hint, /answers ping/);
});

test('router online but no ping reply is Connected, not Offline', () => {
  const status = deriveStatus({ ip: '192.168.1.9', isOnline: true }, DOWN);
  assert.equal(status.key, 'silent');
  assert.equal(status.isUp, true);
});

test('router offline and no ping reply is Offline', () => {
  assert.equal(deriveStatus({ ip: '192.168.1.9', isOnline: false }, DOWN).isUp, false);
});

test('while the probe is pending the router flag is shown and marked as checking', () => {
  const status = deriveStatus({ ip: '192.168.1.9', isOnline: false }, undefined);
  assert.equal(status.key, 'offline');
  assert.equal(status.isChecking, true);
});

test('a device with no IP falls back to the router flag and is never "checking"', () => {
  assert.equal(deriveStatus({ ip: '', isOnline: true }, undefined).isChecking, false);
});
