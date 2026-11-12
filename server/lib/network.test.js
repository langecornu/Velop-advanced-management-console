import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isPrivateIpv4, isInSubnet, isValidHost, isValidIpv4, isValidMac, normalizeMac } from './network.js';

test('normalizeMac accepts every common separator style', () => {
  assert.equal(normalizeMac('aa-bb-cc-dd-ee-ff'), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizeMac('aabbccddeeff'), 'AA:BB:CC:DD:EE:FF');
});

test('isValidMac rejects short, long and non-hex input', () => {
  assert.equal(isValidMac('AA:BB:CC:DD:EE'), false);
  assert.equal(isValidMac('AA:BB:CC:DD:EE:GG'), false);
  assert.equal(isValidMac('AA:BB:CC:DD:EE:FF:00'), false);
  assert.equal(isValidMac('AA:BB:CC:DD:EE:FF'), true);
});

test('isValidIpv4 rejects out of range octets', () => {
  assert.equal(isValidIpv4('192.168.1.256'), false);
  assert.equal(isValidIpv4('192.168.1'), false);
  assert.equal(isValidIpv4('192.168.1.20'), true);
});

test('isInSubnet checks the /24 boundary', () => {
  assert.equal(isInSubnet('192.168.1.200', '192.168.1.1', 24), true);
  assert.equal(isInSubnet('192.168.2.5', '192.168.1.1', 24), false);
});

test('isValidHost blocks shell metacharacters', () => {
  assert.equal(isValidHost('example.com; reboot'), false);
  assert.equal(isValidHost('example.com'), true);
});

test('isPrivateIpv4 allows LAN ranges and refuses public or malformed addresses', () => {
  assert.equal(isPrivateIpv4('192.168.1.117'), true);
  assert.equal(isPrivateIpv4('10.0.0.5'), true);
  assert.equal(isPrivateIpv4('172.20.1.1'), true);
  assert.equal(isPrivateIpv4('172.32.0.1'), false);
  assert.equal(isPrivateIpv4('8.8.8.8'), false);
  assert.equal(isPrivateIpv4('192.168.1.1; reboot'), false);
});
