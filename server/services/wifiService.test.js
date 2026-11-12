import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMockBackups, createMockRouter } from './mockRouter.js';
import { getWifi, labelRadio, updateWifi, validateChanges } from './wifiService.js';

function createRouter() {
  const radio = (radioID, band) => ({
    radioID,
    band,
    settings: {
      isEnabled: true,
      ssid: 'home',
      security: 'WPA2-Personal',
      wpaPersonalSettings: { passphrase: 'old-password' },
    },
  });
  return createMockRouter({
    'wirelessap/GetRadioInfo': { radios: [radio('R24', '2.4GHz'), radio('R5', '5GHz')] },
  });
}

test('getWifi never returns the passphrase, only whether one is set', async () => {
  const wifi = await getWifi(createRouter());
  assert.equal(JSON.stringify(wifi).includes('old-password'), false);
  assert.equal(wifi.radios[0].hasPassphrase, true);
});

test('updateWifi changes the name on every selected radio and backs up the old settings first', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  const result = await updateWifi(router, backups, { ssid: 'newname' });
  assert.deepEqual(
    result.radios.map((item) => item.ssid),
    ['newname', 'newname'],
  );
  assert.equal(backups.saved[0].payload.radios[0].settings.ssid, 'home');
  assert.equal(JSON.stringify(result).includes('old-password'), false);
});

test('updateWifi can change just one radio', async () => {
  const router = createRouter();
  await updateWifi(router, createMockBackups(), { ssid: 'only5', radioIds: ['R5'] });
  assert.deepEqual(
    (await getWifi(router)).radios.map((item) => item.ssid),
    ['home', 'only5'],
  );
});

test('updateWifi refuses to switch off the last radio that is on', async () => {
  const router = createRouter();
  await assert.rejects(updateWifi(router, createMockBackups(), { isEnabled: false }), { status: 409 });
  assert.equal(router.writes.length, 0);
});

test('updateWifi may switch one radio off while another stays on', async () => {
  const router = createRouter();
  await updateWifi(router, createMockBackups(), { isEnabled: false, radioIds: ['R24'] });
  assert.deepEqual(
    (await getWifi(router)).radios.map((item) => item.isEnabled),
    [false, true],
  );
});

test('validateChanges rejects short or non-printable passwords and over-long names', () => {
  assert.throws(() => validateChanges({ passphrase: 'short' }), { status: 400 });
  assert.throws(() => validateChanges({ passphrase: 'bad\u0007password' }), { status: 400 });
  assert.throws(() => validateChanges({ ssid: 'x'.repeat(33) }), { status: 400 });
  assert.throws(() => validateChanges({ ssid: '' }), { status: 400 });
  assert.doesNotThrow(() => validateChanges({ ssid: 'ok', passphrase: 'a-good-password' }));
});

test('updateWifi with nothing to change or an unknown radio writes nothing', async () => {
  const router = createRouter();
  await assert.rejects(updateWifi(router, createMockBackups(), {}), { status: 400 });
  await assert.rejects(updateWifi(router, createMockBackups(), { ssid: 'x', radioIds: ['NOPE'] }), { status: 404 });
  assert.equal(router.writes.length, 0);
});

test('the two 5 GHz radios of a tri-band unit get distinct labels from their channel lists', () => {
  assert.equal(labelRadio({ band: '5GHz', supportedChannels: [0, 36, 40, 44, 48] }).label, '5GHz low');
  assert.equal(labelRadio({ band: '5GHz', supportedChannels: [0, 149, 153, 165] }).label, '5GHz high');
  assert.equal(labelRadio({ band: '5GHz', supportedChannels: [0, 149, 153, 165] }).channelRange, '149-165');
  assert.equal(labelRadio({ band: '2.4GHz', supportedChannels: [0, 1, 6, 11] }).label, '2.4GHz');
  assert.equal(labelRadio({ band: '5GHz' }).label, '5GHz', 'no channel list: fall back to the plain band');
});
