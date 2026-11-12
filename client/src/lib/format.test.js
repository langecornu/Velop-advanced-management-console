import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  RISKY_PORTS,
  formatLease,
  formatUptime,
  ipSortKey,
  minutesToTime,
  sanitizeDescription,
  timeToMinutes,
} from './format.js';

test('sanitizeDescription matches what the router accepts', () => {
  assert.equal(sanitizeDescription('Alex’s Mac mini'), 'AlexsMacmini');
});

test('ipSortKey orders addresses numerically, not alphabetically', () => {
  assert.ok(ipSortKey('192.168.1.9') < ipSortKey('192.168.1.100'));
  assert.equal(ipSortKey(''), Number.POSITIVE_INFINITY);
});

test('formatUptime and formatLease give short readable text', () => {
  assert.equal(formatUptime(90061), '1d 1h');
  assert.equal(formatUptime(3700), '1h 1m');
  assert.equal(formatLease(1440), '24 h');
  assert.equal(formatLease(90), '90 min');
});

test('minutesToTime and timeToMinutes convert both ways, including midnight and late evening', () => {
  assert.equal(minutesToTime(0), '00:00');
  assert.equal(minutesToTime(135), '02:15');
  assert.equal(minutesToTime(1439), '23:59');
  assert.equal(timeToMinutes('02:15'), 135);
  assert.equal(timeToMinutes('garbage'), 0);
  assert.equal(minutesToTime(undefined), '00:00');
});

test('well-known dangerous ports carry a reason', () => {
  assert.match(RISKY_PORTS[5900], /VNC/);
  assert.equal(RISKY_PORTS[8080], undefined);
});
