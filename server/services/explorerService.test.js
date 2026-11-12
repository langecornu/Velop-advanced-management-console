import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  classifyAction,
  createActionDescriber,
  describeShape,
  parseRequiredElements,
  runAction,
} from './explorerService.js';

const MockClient = { callRaw: async () => ({ result: 'OK' }) };

test('classifyAction separates read, write and destructive actions', () => {
  assert.equal(classifyAction('router/GetLANSettings'), 'read');
  assert.equal(classifyAction('router/SetLANSettings'), 'write');
  assert.equal(classifyAction('core/FactoryReset'), 'blocked');
});

test('runAction refuses a write without explicit confirmation', async () => {
  await assert.rejects(runAction(MockClient, { action: 'core/Reboot', request: {}, confirmWrite: false }), {
    status: 409,
  });
});

test('runAction refuses destructive actions even when confirmed', async () => {
  await assert.rejects(runAction(MockClient, { action: 'core/FactoryReset', request: {}, confirmWrite: true }), {
    status: 403,
  });
});

test('runAction runs a read action without confirmation', async () => {
  const result = await runAction(MockClient, { action: 'router/GetWANStatus3', request: {}, confirmWrite: false });
  assert.equal(result.kind, 'read');
});

test('parseRequiredElements reads the field names out of the router validation message', () => {
  const message =
    'Validation of element "X" failed due to unexpected count (0) of child element "includeModuleResults"';
  assert.deepEqual(parseRequiredElements(message), ['includeModuleResults']);
  assert.deepEqual(parseRequiredElements('nothing useful'), []);
});

test('describeShape lists top-level fields with a readable type', () => {
  assert.deepEqual(describeShape({ a: true, b: [1, 2], c: { d: 1 }, e: 'x', f: null }), [
    { name: 'a', type: 'boolean' },
    { name: 'b', type: 'list (2)' },
    { name: 'c', type: 'group' },
    { name: 'e', type: 'string' },
    { name: 'f', type: 'empty' },
  ]);
});

test('describing a read action learns its required input from the router error', async () => {
  const MockClient = {
    callRaw: async () => ({
      result: '_ErrorInvalidInput',
      error: 'unexpected count (0) of child element "includeModuleResults"',
    }),
  };
  const info = await createActionDescriber(MockClient)('healthcheck/GetHealthCheckResults');
  assert.deepEqual(info.requiredInput, ['includeModuleResults']);
});

test('describing a write action never sends it to the router, only its matching read action', async () => {
  const sent = [];
  const MockClient = {
    async callRaw(action) {
      sent.push(action);
      return { result: 'OK', output: { isUPnPEnabled: true } };
    },
  };
  const info = await createActionDescriber(MockClient)('routerupnp/SetUPnPSettings');
  assert.deepEqual(sent, ['routerupnp/GetUPnPSettings']);
  assert.equal(info.kind, 'write');
  assert.deepEqual(info.siblingFields, [{ name: 'isUPnPEnabled', type: 'boolean' }]);
});

test('describing a blocked or slow action never contacts the router', async () => {
  let calls = 0;
  const MockClient = {
    async callRaw() {
      calls += 1;
      return { result: 'OK', output: {} };
    },
  };
  const describe = createActionDescriber(MockClient);
  assert.equal((await describe('core/FactoryReset')).kind, 'blocked');
  assert.equal((await describe('diagnostics/GetSysinfoData')).isSlow, true);
  assert.equal(calls, 0);
});

test('describe answers are cached so repeated clicks do not hit the router again', async () => {
  let calls = 0;
  const MockClient = {
    async callRaw() {
      calls += 1;
      return { result: 'OK', output: { a: 1 } };
    },
  };
  const describe = createActionDescriber(MockClient, { now: () => 1000 });
  await describe('router/GetLANSettings');
  await describe('router/GetLANSettings');
  assert.equal(calls, 1);
});
