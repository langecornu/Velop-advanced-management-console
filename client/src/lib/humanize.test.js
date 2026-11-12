import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyValue, humanizeKey, isScalar } from './humanize.js';

test('humanizeKey makes camelCase keys readable and keeps acronyms', () => {
  assert.equal(humanizeKey('isDHCPEnabled'), 'DHCP enabled');
  assert.equal(humanizeKey('macAddress'), 'MAC address');
  assert.equal(humanizeKey('dhcpSettings'), 'DHCP settings');
  assert.equal(humanizeKey('firstClientIPAddress'), 'First client IP address');
  assert.equal(humanizeKey('uptimeSeconds'), 'Uptime');
  assert.equal(humanizeKey('wanIPv6Status'), 'WAN IPv6 status');
  assert.equal(humanizeKey('linkLocalIPv6Address'), 'Link local IPv6 address');
  assert.equal(humanizeKey('upstreamBandwidthbps'), 'Upstream bandwidthbps');
});

test('classifyValue recognises MAC, IP and date strings', () => {
  assert.equal(classifyValue('x', 'aa-bb-cc-dd-ee-ff').text, 'AA:BB:CC:DD:EE:FF');
  assert.equal(classifyValue('x', '192.168.1.5').kind, 'ip');
  assert.equal(classifyValue('x', '2026-11-12T17:48:03Z').kind, 'date');
});

test('classifyValue humanises durations and bandwidth by key suffix', () => {
  assert.equal(classifyValue('uptimeSeconds', 90061).text, '1d 1h');
  assert.equal(classifyValue('leaseMinutes', 1440).text, '24 h');
  assert.equal(classifyValue('downstreamBps', 250_000_000).text, '250 Mbps');
});

test('classifyValue shows booleans and empties explicitly', () => {
  assert.deepEqual(classifyValue('x', false), { kind: 'bool', text: 'No', isTrue: false });
  assert.equal(classifyValue('x', null).kind, 'empty');
  assert.equal(classifyValue('x', '').kind, 'empty');
});

test('isScalar treats arrays and objects as complex', () => {
  assert.equal(isScalar('a'), true);
  assert.equal(isScalar(null), true);
  assert.equal(isScalar([]), false);
  assert.equal(isScalar({}), false);
});
