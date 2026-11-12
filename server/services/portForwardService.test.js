import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMockBackups, createMockRouter } from './mockRouter.js';
import { addRule, deleteRule, getPortForwarding, updateRule } from './portForwardService.js';

const RULE = {
  isEnabled: true,
  externalPort: 8080,
  protocol: 'TCP',
  internalIp: '192.168.1.50',
  internalPort: 80,
  description: 'web',
};

function createRouter(rules = []) {
  return createMockRouter({
    'router/GetLANSettings': { ipAddress: '192.168.1.1', networkPrefixLength: 24 },
    'firewall/GetSinglePortForwardingRules': {
      rules: rules.map(({ internalIp, ...rest }) => ({ ...rest, internalServerIPAddress: internalIp })),
      maxDescriptionLength: 32,
      maxRules: 3,
    },
    'firewall/GetPortRangeForwardingRules': { rules: [] },
    'firewall/GetPortRangeTriggeringRules': { rules: [] },
    'firewall/GetIPv6FirewallRules': { rules: [{}, {}] },
    'firewall/GetDMZSettings': { isDMZEnabled: false },
  });
}

test('getPortForwarding lists the rules and counts the other rule types', async () => {
  const view = await getPortForwarding(createRouter([RULE]));
  assert.equal(view.rules[0].internalIp, '192.168.1.50');
  assert.equal(view.others.ipv6Firewall, 2);
  assert.equal(view.others.isDmzEnabled, false);
});

test('addRule saves a backup and writes the rule in the router format', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  const view = await addRule(router, backups, RULE);
  assert.equal(view.rules.length, 1);
  assert.equal(router.writes.at(-1).request.rules[0].internalServerIPAddress, '192.168.1.50');
  assert.deepEqual(backups.saved[0].payload.rules, []);
});

test('addRule refuses bad ports, protocols, and addresses outside the LAN or the router itself', async () => {
  const router = createRouter();
  for (const bad of [
    { externalPort: 0 },
    { internalPort: 70000 },
    { protocol: 'ICMP' },
    { internalIp: '8.8.8.8' },
    { internalIp: '192.168.2.5' },
    { internalIp: '192.168.1.1' },
  ]) {
    await assert.rejects(
      addRule(router, createMockBackups(), { ...RULE, ...bad }),
      { status: 400 },
      JSON.stringify(bad),
    );
  }
  assert.equal(router.writes.length, 0);
});

test('addRule refuses a description with odd characters or one that is too long', async () => {
  const router = createRouter();
  await assert.rejects(addRule(router, createMockBackups(), { ...RULE, description: 'bad;name' }), { status: 400 });
  await assert.rejects(addRule(router, createMockBackups(), { ...RULE, description: 'x'.repeat(33) }), { status: 400 });
});

test('the same external port cannot be forwarded twice on overlapping protocols, but TCP and UDP can coexist', async () => {
  const router = createRouter([RULE]);
  await assert.rejects(
    addRule(router, createMockBackups(), { ...RULE, protocol: 'Both', internalIp: '192.168.1.60' }),
    { status: 409 },
  );
  const view = await addRule(router, createMockBackups(), { ...RULE, protocol: 'UDP', internalIp: '192.168.1.60' });
  assert.equal(view.rules.length, 2);
});

test('the router rule limit is respected', async () => {
  const router = createRouter([RULE, { ...RULE, externalPort: 1 }, { ...RULE, externalPort: 2 }]);
  await assert.rejects(addRule(router, createMockBackups(), { ...RULE, externalPort: 3 }), { status: 409 });
});

test('updateRule may keep its own port, and deleteRule removes exactly one rule', async () => {
  const router = createRouter([RULE, { ...RULE, externalPort: 9090 }]);
  const updated = await updateRule(router, createMockBackups(), 0, { ...RULE, description: 'renamed' });
  assert.equal(updated.rules[0].description, 'renamed');
  const after = await deleteRule(router, createMockBackups(), 0);
  assert.deepEqual(
    after.rules.map((rule) => rule.externalPort),
    [9090],
  );
  await assert.rejects(deleteRule(router, createMockBackups(), 5), { status: 404 });
});
