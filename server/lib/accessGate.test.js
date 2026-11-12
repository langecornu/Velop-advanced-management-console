import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAccessGate, isLoopbackAddress } from './accessGate.js';

const PASSWORD = 'correct-horse-battery';
const basic = (user, password) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

function run(gate, { address = '192.168.1.50', authorization } = {}) {
  const res = {
    statusCode: 200,
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    type() {
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
  let passed = false;
  gate({ socket: { remoteAddress: address }, headers: authorization ? { authorization } : {} }, res, () => {
    passed = true;
  });
  return { passed, res };
}

test('a request from this computer needs no password', () => {
  const gate = createAccessGate({ password: PASSWORD });
  for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    assert.equal(run(gate, { address }).passed, true, address);
  }
  assert.equal(isLoopbackAddress('192.168.1.5'), false);
});

test('a network client without a password gets a login prompt, not the app', () => {
  const { passed, res } = run(createAccessGate({ password: PASSWORD }));
  assert.equal(passed, false);
  assert.equal(res.statusCode, 401);
  assert.match(res.headers['WWW-Authenticate'], /^Basic realm=/);
});

test('the right password lets a network client in, whatever user name it uses', () => {
  const gate = createAccessGate({ password: PASSWORD });
  assert.equal(run(gate, { authorization: basic('phone', PASSWORD) }).passed, true);
  assert.equal(run(gate, { authorization: basic('', PASSWORD) }).passed, true);
});

test('wrong passwords, a different length, and other auth schemes are refused', () => {
  const gate = createAccessGate({ password: PASSWORD });
  for (const authorization of [
    basic('x', 'wrong'),
    basic('x', `${PASSWORD}x`),
    basic('x', ''),
    'Bearer abc',
    'Basic',
    'Basic !!!notbase64',
  ]) {
    const { passed, res } = run(gate, { authorization });
    assert.equal(passed, false, authorization);
    assert.equal(res.statusCode, 401, authorization);
  }
});

test('a password containing a colon still works', () => {
  const gate = createAccessGate({ password: 'pass:word:123' });
  assert.equal(run(gate, { authorization: basic('u', 'pass:word:123') }).passed, true);
});

test('after ten wrong guesses an address is locked out, even with the right password, until the window ends', () => {
  let clock = 1_000_000;
  const gate = createAccessGate({ password: PASSWORD, now: () => clock });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal(run(gate, { authorization: basic('x', 'nope') }).res.statusCode, 401);
  }
  const locked = run(gate, { authorization: basic('x', PASSWORD) });
  assert.equal(locked.passed, false);
  assert.equal(locked.res.statusCode, 429);
  clock += 11 * 60_000;
  assert.equal(run(gate, { authorization: basic('x', PASSWORD) }).passed, true, 'the lockout expires');
});

test('the lockout is per address, and an empty first request from a browser is not counted as a guess', () => {
  const gate = createAccessGate({ password: PASSWORD });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    run(gate, { address: '192.168.1.60' });
  }
  assert.equal(run(gate, { address: '192.168.1.60', authorization: basic('x', PASSWORD) }).passed, true);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    run(gate, { address: '192.168.1.70', authorization: basic('x', 'nope') });
  }
  assert.equal(run(gate, { address: '192.168.1.70', authorization: basic('x', PASSWORD) }).res.statusCode, 429);
  assert.equal(run(gate, { address: '192.168.1.71', authorization: basic('x', PASSWORD) }).passed, true);
});
