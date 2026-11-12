import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adaptOutput } from './adapters.js';

test('GetDevices3 is flattened into one friendly row per device', () => {
  const output = {
    revision: 7,
    devices: [
      {
        friendlyName: 'TV',
        model: { deviceType: 'Entertainment', manufacturer: 'Sony', modelNumber: 'X1' },
        knownInterfaces: [{ macAddress: 'AA:BB:CC:00:11:22', interfaceType: 'Wireless', band: '5GHz' }],
        connections: [{ ipAddress: '192.168.1.5' }],
      },
    ],
  };
  const adapted = adaptOutput('devicelist/GetDevices3', output);
  assert.equal(adapted.devices[0].ipAddress, '192.168.1.5');
  assert.equal(adapted.devices[0].connected, true);
  assert.equal(adapted.devices[0].band, '5GHz');
});

test('unknown actions and malformed output pass through untouched', () => {
  const output = { a: 1 };
  assert.equal(adaptOutput('router/GetLANSettings', output), output);
  assert.equal(adaptOutput('devicelist/GetDevices3', { nope: true }).nope, true);
});
