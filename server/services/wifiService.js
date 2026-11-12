// Wi-Fi: view the radios and change name, password or on/off. Passwords are write-only: they are never returned.
import { httpError } from '../lib/httpError.js';
import { sendSet } from './routerWrite.js';

const SET_ACTION = 'wirelessap/SetRadioSettings';
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;
const HEX_64 = /^[0-9a-fA-F]{64}$/;

// A tri-band Velop has two separate 5 GHz radios; tell them apart by the channels they can use.
export function labelRadio(radio) {
  const channels = (radio.supportedChannels ?? []).filter((channel) => channel > 0);
  if (radio.band !== '5GHz' || channels.length === 0) {
    return { label: radio.band, channelRange: channels.length ? `${channels[0]}-${channels.at(-1)}` : '' };
  }
  const tier = channels[0] < 100 ? 'low' : 'high';
  return { label: `5GHz ${tier}`, channelRange: `${channels[0]}-${channels.at(-1)}` };
}

function describe(radio) {
  const settings = radio.settings ?? {};
  return {
    radioId: radio.radioID,
    band: radio.band,
    ...labelRadio(radio),
    ssid: settings.ssid,
    isEnabled: Boolean(settings.isEnabled),
    isBroadcasting: Boolean(settings.broadcastSSID),
    security: settings.security,
    channel: settings.channel,
    channelWidth: settings.channelWidth,
    hasPassphrase: Boolean(settings.wpaPersonalSettings?.passphrase),
  };
}

export function validateChanges({ ssid, passphrase }) {
  if (ssid !== undefined && (ssid.length < 1 || Buffer.byteLength(ssid, 'utf8') > 32)) {
    throw httpError(400, 'The Wi-Fi name must be 1 to 32 bytes long');
  }
  if (
    passphrase !== undefined &&
    !(
      (passphrase.length >= 8 && passphrase.length <= 63 && PRINTABLE_ASCII.test(passphrase)) ||
      HEX_64.test(passphrase)
    )
  ) {
    throw httpError(400, 'The Wi-Fi password must be 8 to 63 printable characters (or 64 hex digits)');
  }
}

export async function getWifi(client) {
  const info = await client.call('wirelessap/GetRadioInfo');
  return { radios: (info.radios ?? []).map(describe) };
}

export async function updateWifi(client, backups, { radioIds, ssid, passphrase, isEnabled }) {
  validateChanges({ ssid, passphrase });
  if (ssid === undefined && passphrase === undefined && isEnabled === undefined) {
    throw httpError(400, 'Nothing to change');
  }
  const info = await client.call('wirelessap/GetRadioInfo');
  const all = info.radios ?? [];
  const targets = radioIds?.length ? all.filter((radio) => radioIds.includes(radio.radioID)) : all;
  if (targets.length === 0 || (radioIds?.length && targets.length !== radioIds.length)) {
    throw httpError(404, 'One or more radios were not found');
  }
  if (isEnabled === false) {
    const staysOn = all.filter((radio) => radio.settings?.isEnabled && !targets.includes(radio));
    if (staysOn.length === 0) {
      throw httpError(409, 'At least one Wi-Fi radio must stay on, otherwise nothing can connect wirelessly');
    }
  }
  if (passphrase !== undefined && targets.some((radio) => radio.settings?.security === 'None')) {
    throw httpError(400, 'A selected radio has no security, so it has no password to set');
  }

  const before = {
    radios: targets.map((radio) => ({ radioID: radio.radioID, settings: structuredClone(radio.settings) })),
  };
  const after = structuredClone(before);
  after.radios.forEach(({ settings }) => {
    if (ssid !== undefined) {
      settings.ssid = ssid;
    }
    if (passphrase !== undefined) {
      settings.wpaPersonalSettings = { ...settings.wpaPersonalSettings, passphrase };
    }
    if (isEnabled !== undefined) {
      settings.isEnabled = isEnabled;
    }
  });

  const backup = await backups.save({
    label: `Wi-Fi settings (${targets.map((radio) => labelRadio(radio).label).join(' + ')})`,
    setAction: SET_ACTION,
    payload: before,
  });
  const { removed } = await sendSet(client, SET_ACTION, after);
  return { backup, removedFields: removed, ...(await getWifi(client)) };
}
