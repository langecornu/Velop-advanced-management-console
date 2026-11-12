import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadConfig } from './config.js';

const BASE = { ROUTER_PASSWORD: 'router-pass' };

test('by default the tool listens on the network, and then insists on an access password', () => {
  assert.throws(() => loadConfig(BASE), /ACCESS_PASSWORD/);
  const config = loadConfig({ ...BASE, ACCESS_PASSWORD: 'long-enough-1' });
  assert.equal(config.bindAddress, '0.0.0.0');
  assert.equal(config.accessPassword, 'long-enough-1');
});

test('listening on this computer only needs no access password', () => {
  for (const bind of ['127.0.0.1', '::1', 'localhost']) {
    assert.equal(loadConfig({ ...BASE, BIND_ADDRESS: bind }).bindAddress, bind);
  }
});

test('a short access password and an empty one are both refused when listening on the network', () => {
  assert.throws(() => loadConfig({ ...BASE, ACCESS_PASSWORD: 'short' }), /8 characters/);
  assert.throws(() => loadConfig({ ...BASE, ACCESS_PASSWORD: '' }), /ACCESS_PASSWORD/);
});

test('the router password may still be given under its older name, and is required', () => {
  assert.equal(loadConfig({ ROUTERPW: 'old-name', BIND_ADDRESS: '127.0.0.1' }).routerPassword, 'old-name');
  assert.throws(() => loadConfig({ BIND_ADDRESS: '127.0.0.1' }), /ROUTER_PASSWORD/);
});
