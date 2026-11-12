import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addReservation, removeReservation, sanitizeDescription, toSetPayload } from './dhcpService.js';

function createMockClient(reservations = []) {
  const calls = [];
  return {
    calls,
    async call(action, request) {
      calls.push({ action, request });
      if (action === 'router/GetLANSettings') {
        return {
          ipAddress: '192.168.1.1',
          networkPrefixLength: 24,
          isDHCPEnabled: true,
          minNetworkPrefixLength: 16,
          maxAllowedDHCPLeaseMinutes: 2880,
          minAllowedDHCPLeaseMinutes: 5,
          maxDHCPReservationDescriptionLength: 63,
          dhcpSettings: { leaseMinutes: 1440, reservations },
        };
      }
      return {};
    },
  };
}

test('addReservation writes the new reservation without read-only fields', async () => {
  const client = createMockClient();
  await addReservation(client, { macAddress: 'aa-bb-cc-dd-ee-ff', ipAddress: '192.168.1.60', description: 'nas' });
  const write = client.calls.find((item) => item.action === 'router/SetLANSettings');
  for (const field of [
    'minNetworkPrefixLength',
    'maxAllowedDHCPLeaseMinutes',
    'minAllowedDHCPLeaseMinutes',
    'maxDHCPReservationDescriptionLength',
  ]) {
    assert.equal(write.request[field], undefined, `${field} is read-only and must be stripped`);
  }
  assert.deepEqual(write.request.dhcpSettings.reservations, [
    { macAddress: 'AA:BB:CC:DD:EE:FF', ipAddress: '192.168.1.60', description: 'nas' },
  ]);
});

test('addReservation rejects an IP outside the subnet', async () => {
  await assert.rejects(addReservation(createMockClient(), { macAddress: 'AA:BB:CC:DD:EE:FF', ipAddress: '10.0.0.5' }), {
    status: 400,
  });
});

test('addReservation rejects an IP already reserved for another device', async () => {
  const client = createMockClient([{ macAddress: '11:22:33:44:55:66', ipAddress: '192.168.1.60', description: '' }]);
  await assert.rejects(addReservation(client, { macAddress: 'AA:BB:CC:DD:EE:FF', ipAddress: '192.168.1.60' }), {
    status: 409,
  });
});

test('addReservation replaces an existing reservation for the same MAC instead of duplicating it', async () => {
  const client = createMockClient([{ macAddress: 'AA:BB:CC:DD:EE:FF', ipAddress: '192.168.1.60', description: '' }]);
  await addReservation(client, { macAddress: 'AA:BB:CC:DD:EE:FF', ipAddress: '192.168.1.61' });
  const write = client.calls.find((item) => item.action === 'router/SetLANSettings');
  assert.equal(write.request.dhcpSettings.reservations.length, 1);
  assert.equal(write.request.dhcpSettings.reservations[0].ipAddress, '192.168.1.61');
});

test('removeReservation returns 404 when nothing matches and never writes', async () => {
  const client = createMockClient();
  await assert.rejects(removeReservation(client, 'AA:BB:CC:DD:EE:FF'), { status: 404 });
  assert.equal(
    client.calls.some((item) => item.action === 'router/SetLANSettings'),
    false,
  );
});

test('toSetPayload does not mutate the settings it was given', () => {
  const lan = { dhcpSettings: { reservations: [] }, minNetworkPrefixLength: 8 };
  toSetPayload(lan, [{ macAddress: 'X' }]);
  assert.equal(lan.minNetworkPrefixLength, 8);
});

test('sanitizeDescription reduces a device name to what the router accepts', () => {
  assert.equal(sanitizeDescription('Alex’s Mac mini'), 'AlexsMacmini');
  assert.equal(sanitizeDescription('Café TV (living room)'), 'CafeTVlivingroom');
  assert.equal(sanitizeDescription('x'.repeat(100), 63).length, 63);
  assert.equal(sanitizeDescription(undefined), '');
});

test('addReservation stores a sanitized description', async () => {
  const client = createMockClient();
  await addReservation(client, {
    macAddress: 'AA:BB:CC:DD:EE:FF',
    ipAddress: '192.168.1.60',
    description: 'Alex’s Mac mini',
  });
  const write = client.calls.find((item) => item.action === 'router/SetLANSettings');
  assert.equal(write.request.dhcpSettings.reservations[0].description, 'AlexsMacmini');
});
