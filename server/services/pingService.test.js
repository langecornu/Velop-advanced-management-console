import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPingArgs, parseRoundTripMs, probeHosts } from './pingService.js';

test('buildPingArgs uses milliseconds on macOS and seconds on Linux', () => {
  assert.deepEqual(buildPingArgs('192.168.1.5', 'darwin'), ['-c', '1', '-W', '1500', '192.168.1.5']);
  assert.deepEqual(buildPingArgs('192.168.1.5', 'linux'), ['-c', '1', '-W', '2', '192.168.1.5']);
});

test('parseRoundTripMs reads the reply time and returns null when there is none', () => {
  assert.equal(parseRoundTripMs('64 bytes from 192.168.1.117: icmp_seq=0 ttl=64 time=17.961 ms'), 18);
  assert.equal(parseRoundTripMs('Request timeout for icmp_seq 0'), null);
});

test('probeHosts returns one result per unique address', async () => {
  const MockPing = async (ip) => ({ reachable: ip.endsWith('.1'), rttMs: 5 });
  const result = await probeHosts(['192.168.1.1', '192.168.1.2', '192.168.1.1'], { ping: MockPing });
  assert.deepEqual(Object.keys(result).sort(), ['192.168.1.1', '192.168.1.2']);
  assert.equal(result['192.168.1.1'].reachable, true);
  assert.equal(result['192.168.1.2'].reachable, false);
});

test('probeHosts refuses public addresses and never pings them', async () => {
  let calls = 0;
  const MockPing = async () => {
    calls += 1;
    return { reachable: true, rttMs: 1 };
  };
  await assert.rejects(probeHosts(['192.168.1.5', '8.8.8.8'], { ping: MockPing }), { status: 400 });
  assert.equal(calls, 0);
});

test('probeHosts never runs more pings at once than the concurrency limit', async () => {
  let active = 0;
  let peak = 0;
  const MockPing = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return { reachable: true, rttMs: 1 };
  };
  const ips = Array.from({ length: 40 }, (_, index) => `192.168.1.${index + 1}`);
  await probeHosts(ips, { ping: MockPing, concurrency: 8 });
  assert.ok(peak <= 8, `peak ${peak} exceeded the limit`);
});

test('probeHosts rejects an oversized request', async () => {
  const ips = Array.from({ length: 301 }, (_, index) => `10.0.${Math.floor(index / 250)}.${index % 250}`);
  await assert.rejects(probeHosts(ips, { ping: async () => ({ reachable: true }) }), { status: 400 });
});
