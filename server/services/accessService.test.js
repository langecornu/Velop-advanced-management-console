import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getAccess, removeParentalRule, setMacFilter, validateMacFilter } from './accessService.js';
import { createMockBackups, createMockRouter } from './mockRouter.js';

function createRouter() {
  return createMockRouter({
    'macfilter/GetMACFilterSettings': { macFilterMode: 'Disabled', macAddresses: [], maxMACAddresses: 32 },
    'parentalcontrol/GetParentalControlSettings': {
      isParentalControlEnabled: false,
      rules: [
        {
          description: 'kid tablet',
          isEnabled: true,
          macAddresses: ['AA:BB:CC:DD:EE:01'],
          wanSchedule: { monday: '0001' },
          blockedURLs: [],
        },
        {
          description: 'tv',
          isEnabled: true,
          macAddresses: ['AA:BB:CC:DD:EE:02'],
          wanSchedule: { monday: '0000' },
          blockedURLs: [],
        },
      ],
    },
  });
}

test('getAccess summarises the filter and rules, flagging which rules have a schedule', async () => {
  const access = await getAccess(createRouter());
  assert.equal(access.macFilter.mode, 'Disabled');
  assert.deepEqual(
    access.parental.rules.map((rule) => rule.isScheduled),
    [true, false],
  );
});

test('validateMacFilter normalises, de-duplicates and rejects bad input', () => {
  assert.deepEqual(validateMacFilter({ mode: 'Deny', macAddresses: ['aa-bb-cc-dd-ee-01', 'AA:BB:CC:DD:EE:01'] }, 32), [
    'AA:BB:CC:DD:EE:01',
  ]);
  assert.throws(() => validateMacFilter({ mode: 'Nonsense', macAddresses: [] }, 32), { status: 400 });
  assert.throws(() => validateMacFilter({ mode: 'Deny', macAddresses: ['zz'] }, 32), { status: 400 });
  assert.throws(
    () => validateMacFilter({ mode: 'Deny', macAddresses: ['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02'] }, 1),
    { status: 400 },
  );
});

test('an allow list with no devices is refused because it would block everything', async () => {
  const router = createRouter();
  await assert.rejects(setMacFilter(router, createMockBackups(), { mode: 'Allow', macAddresses: [] }), { status: 409 });
  assert.equal(router.writes.length, 0);
});

test('setMacFilter backs up, writes and verifies the new mode', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  const result = await setMacFilter(router, backups, { mode: 'Deny', macAddresses: ['aa:bb:cc:dd:ee:09'] });
  assert.equal(result.macFilter.mode, 'Deny');
  assert.deepEqual(result.macFilter.macAddresses, ['AA:BB:CC:DD:EE:09']);
  assert.equal(backups.saved[0].payload.macFilterMode, 'Disabled');
});

test('removeParentalRule removes exactly the chosen rule and keeps a backup of all of them', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  const result = await removeParentalRule(router, backups, 0);
  assert.deepEqual(
    result.parental.rules.map((rule) => rule.description),
    ['tv'],
  );
  assert.equal(backups.saved[0].payload.rules.length, 2);
});

test('removeParentalRule rejects an index that does not exist', async () => {
  const router = createRouter();
  await assert.rejects(removeParentalRule(router, createMockBackups(), 9), { status: 404 });
  await assert.rejects(removeParentalRule(router, createMockBackups(), -1), { status: 404 });
  assert.equal(router.writes.length, 0);
});
