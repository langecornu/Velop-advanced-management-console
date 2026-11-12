import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMockRouter } from './mockRouter.js';
import { parseUnexpectedMember, sendSet, stripMember } from './routerWrite.js';

test('parseUnexpectedMember reads the field name out of the router error', () => {
  assert.equal(parseUnexpectedMember('Encountered unexpected member "section" for element "X"'), 'section');
  assert.equal(parseUnexpectedMember('something else'), null);
});

test('stripMember removes a field at any depth without mutating the original', () => {
  const original = { a: 1, nested: [{ b: 2, a: 3 }] };
  assert.deepEqual(stripMember(original, 'a'), { nested: [{ b: 2 }] });
  assert.equal(original.a, 1);
});

test('sendSet drops read-only fields the router names, then succeeds', async () => {
  const router = createMockRouter({ 'routerleds/GetRouterLEDSettings': { isSwitchportLEDEnabled: false } });
  const result = await sendSet(router, 'routerleds/SetRouterLEDSettings', {
    isSwitchportLEDEnabled: true,
    readOnlyThing: 5,
  });
  assert.deepEqual(result.removed, ['readOnlyThing']);
  assert.deepEqual(router.writes.at(-1).request, { isSwitchportLEDEnabled: true });
});

test('sendSet gives up with a clear error when the router rejects for another reason', async () => {
  const MockClient = { callRaw: async () => ({ result: '_ErrorInvalidInput', error: 'value out of range' }) };
  await assert.rejects(sendSet(MockClient, 'a/SetB', { x: 1 }), /value out of range/);
});

test('sendSet never loops forever on a router that keeps naming new fields', async () => {
  let calls = 0;
  const MockClient = {
    async callRaw() {
      calls += 1;
      return { result: '_ErrorInvalidInput', error: `Encountered unexpected member "f${calls}" for element "X"` };
    },
  };
  await assert.rejects(sendSet(MockClient, 'a/SetB', {}), { status: 502 });
  assert.ok(calls <= 14);
});
