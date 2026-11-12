import assert from 'node:assert/strict';
import { test } from 'node:test';

import { summarizeUpdates } from './updates.js';

const NOW = Date.parse('2026-11-12T20:00:00Z');
const AUTO = { firmware: { policy: 'AutomaticallyCheckAndInstall' } };
const MANUAL = { firmware: { policy: 'Manual' } };
const node = (name, extra = {}) => ({ name, lastCheck: '2026-11-12T18:00:00Z', availableUpdate: null, ...extra });

test('recent checks, nothing waiting and auto-update on means up to date', () => {
  const result = summarizeUpdates([node('Kitchen'), node('Office')], AUTO, NOW);
  assert.equal(result.tone, 'ok');
  assert.match(result.text, /up to date/);
});

test('a pending update is named and says automatic updates will install it', () => {
  const result = summarizeUpdates([node('Kitchen', { availableUpdate: { v: 1 } }), node('Office')], AUTO, NOW);
  assert.equal(result.tone, 'info');
  assert.match(result.text, /Kitchen/);
  assert.match(result.text, /Automatic updates will install it/);
});

test('with automatic updates off the verdict warns that nothing will change by itself', () => {
  const result = summarizeUpdates([node('Kitchen')], MANUAL, NOW);
  assert.equal(result.tone, 'bad');
  assert.match(result.text, /off/);
});

test('a node that has not checked for two days is called out by name', () => {
  const result = summarizeUpdates([node('Kitchen'), node('Garage', { lastCheck: '2026-11-01T00:00:00Z' })], AUTO, NOW);
  assert.equal(result.tone, 'bad');
  assert.match(result.text, /Garage/);
  assert.doesNotMatch(result.text, /Kitchen/);
});

test('a node that never reported a check counts as stale, and the policy being unknown does not claim it is off', () => {
  assert.equal(summarizeUpdates([node('Kitchen', { lastCheck: '' })], undefined, NOW).tone, 'bad');
  assert.equal(summarizeUpdates([node('Kitchen')], undefined, NOW).tone, 'ok');
});
