import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDeviceCache, normalizeDevices, searchDevices } from './deviceService.js';

const DEVICES = [
  {
    deviceID: 'a1',
    friendlyName: 'Living Room TV',
    knownInterfaces: [{ macAddress: 'AA:BB:CC:00:11:22', interfaceType: 'Wireless' }],
    connections: [{ macAddress: 'AA:BB:CC:00:11:22', ipAddress: '192.168.1.50' }],
  },
  {
    deviceID: 'b2',
    friendlyName: 'Old Phone',
    knownInterfaces: [{ macAddress: '11:22:33:44:55:66', interfaceType: 'Wireless' }],
    connections: [],
  },
];
const LEASES = [{ macAddress: '99:88:77:66:55:44', ipAddress: '192.168.1.77', hostName: 'printer' }];
const RESERVATIONS = [{ macAddress: 'AA:BB:CC:00:11:22', ipAddress: '192.168.1.50', description: 'tv' }];

test('normalizeDevices merges reservations and adds lease-only clients', () => {
  const rows = normalizeDevices({ devices: DEVICES, leases: LEASES, reservations: RESERVATIONS });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].reservedIp, '192.168.1.50');
  assert.equal(rows[1].isOnline, false);
  assert.equal(rows[2].source, 'dhcp-lease');
});

test('searchDevices finds a device by a MAC fragment in any format', () => {
  const rows = normalizeDevices({ devices: DEVICES, leases: LEASES });
  assert.deepEqual(
    searchDevices(rows, 'aabb.cc00').map((row) => row.deviceId),
    ['a1'],
  );
  assert.deepEqual(
    searchDevices(rows, '66-55-44').map((row) => row.name),
    ['printer'],
  );
});

test('searchDevices finds a device by partial IP and by name', () => {
  const rows = normalizeDevices({ devices: DEVICES, leases: LEASES });
  assert.deepEqual(
    searchDevices(rows, '1.77').map((row) => row.name),
    ['printer'],
  );
  assert.deepEqual(
    searchDevices(rows, 'living').map((row) => row.deviceId),
    ['a1'],
  );
});

test('searchDevices returns nothing for an unknown query', () => {
  assert.equal(searchDevices(normalizeDevices({ devices: DEVICES }), '10.9.9.9').length, 0);
});

test('a known device with no live connection takes its IP from its DHCP lease and is found by that IP', () => {
  const devices = [
    {
      deviceID: 'c3',
      friendlyName: 'Mac mini',
      knownInterfaces: [{ macAddress: 'AA:BB:CC:B4:42:4F' }],
      connections: [],
    },
  ];
  const leases = [{ macAddress: 'aa:bb:cc:b4:42:4f', ipAddress: '192.168.1.117', hostName: 'dev-box' }];
  const rows = normalizeDevices({ devices, leases });
  assert.equal(rows.length, 1, 'the lease must not create a duplicate row');
  assert.equal(rows[0].ip, '192.168.1.117');
  assert.equal(rows[0].isOnline, false);
  assert.deepEqual(
    searchDevices(rows, '192.168.1.117').map((row) => row.name),
    ['Mac mini'],
  );
  assert.deepEqual(
    searchDevices(rows, 'dev-box').map((row) => row.name),
    ['Mac mini'],
  );
});

test('the device cache shares one router fetch between concurrent callers and serves repeats from memory', async () => {
  let fetches = 0;
  const MockClient = {
    async callRaw() {
      return { result: 'OK', output: {} };
    },
    async transaction() {
      fetches += 1;
      return [{ output: { devices: [] } }, { output: { leases: [] } }, { output: { dhcpSettings: {} } }];
    },
  };
  const cache = createDeviceCache(MockClient, { now: () => 1000, ttlMs: 15000 });
  await Promise.all([cache.get(), cache.get(), cache.get()]);
  await cache.get();
  assert.equal(fetches, 1, 'one fetch for all four calls');
  await cache.get(true);
  assert.equal(fetches, 2, 'a forced refresh must go to the router');
});

test('the device cache refetches once the entry is older than the time to live', async () => {
  let fetches = 0;
  let clock = 0;
  const MockClient = {
    async callRaw() {
      return { result: 'OK', output: {} };
    },
    async transaction() {
      fetches += 1;
      return [{ output: { devices: [] } }, { output: { leases: [] } }, { output: { dhcpSettings: {} } }];
    },
  };
  const cache = createDeviceCache(MockClient, { now: () => clock, ttlMs: 15000 });
  await cache.get();
  clock = 16000;
  await cache.get();
  assert.equal(fetches, 2);
});

test('the name set in the Linksys app wins over the hostname, and nodes get their IP and link from backhaul', () => {
  const devices = [
    {
      deviceID: 'node-1',
      friendlyName: 'LINKSYS05590',
      isAuthority: false,
      model: { deviceType: 'Infrastructure', modelNumber: 'WHW01' },
      unit: { firmwareVersion: '1.1.13' },
      knownInterfaces: [{ macAddress: 'C4:41:1E:E9:BE:77' }],
      connections: [],
      properties: [
        { name: 'userDeviceName', value: 'Kitchen' },
        { name: 'userDeviceLocation', value: 'Kitchen' },
      ],
    },
  ];
  const backhaul = [
    { deviceUUID: 'node-1', ipAddress: '192.168.1.76', connectionType: 'Wireless', speedMbps: '139.614' },
  ];
  const [row] = normalizeDevices({ devices, backhaul });
  assert.equal(row.name, 'Kitchen');
  assert.equal(row.hostname, 'LINKSYS05590');
  assert.equal(row.ip, '192.168.1.76');
  assert.equal(row.isOnline, true);
  assert.equal(row.isNode, true);
  assert.equal(row.backhaul, 'Wireless · 140 Mbps');
  assert.deepEqual(searchDevices([row], 'linksys05590').length, 1, 'the hostname stays searchable');
  assert.deepEqual(searchDevices([row], 'kitchen').length, 1);
});

test('a node absent from backhaul and the connection list stays offline', () => {
  const devices = [
    {
      deviceID: 'node-2',
      friendlyName: 'LINKSYS06056',
      model: { deviceType: 'Infrastructure' },
      knownInterfaces: [],
      connections: [],
      properties: [{ name: 'userDeviceName', value: 'Garage' }],
    },
  ];
  const [row] = normalizeDevices({ devices, backhaul: [] });
  assert.equal(row.name, 'Garage');
  assert.equal(row.isOnline, false);
  assert.equal(row.ip, '');
});
