// Test double for the router: keeps settings in memory, validates Set payloads like the real firmware
// (unknown members are rejected without applying anything) and records every write.
export function createMockRouter(state) {
  const writes = [];
  const allowed = {
    'routerleds/SetRouterLEDSettings': ['isSwitchportLEDEnabled'],
    'firewall/SetFirewallSettings': Object.keys(state['firewall/GetFirewallSettings'] ?? {}),
    'wirelessap/SetRadioSettings': ['radios', 'radioID', 'settings'],
  };
  const getFor = (setAction) => setAction.replace('/Set', '/Get');
  return {
    writes,
    state,
    async transaction(calls) {
      return Promise.all(
        calls.map(async (item) => {
          const response = await this.callRaw(item.action, item.request ?? {});
          return { action: item.action, result: response.result, output: response.output ?? {} };
        }),
      );
    },
    async call(action, request) {
      const response = await this.callRaw(action, request);
      if (response.result !== 'OK') {
        throw new Error(`mock router: ${response.result}`);
      }
      return response.output ?? {};
    },
    async callRaw(action, request = {}) {
      if (action.includes('/Get')) {
        return state[action]
          ? { result: 'OK', output: structuredClone(state[action]) }
          : { result: '_ErrorUnknownAction' };
      }
      if (action === 'core/Reboot') {
        writes.push({ action });
        return { result: 'OK' };
      }
      if (action === 'devicelist/SetDeviceProperties') {
        const device = state['devicelist/GetDevices3'].devices.find((item) => item.deviceID === request.deviceID);
        writes.push({ action, request: structuredClone(request) });
        request.propertiesToModify.forEach(({ name, value }) => {
          const property = device.properties.find((item) => item.name === name);
          if (property) {
            property.value = value;
          } else {
            device.properties.push({ name, value });
          }
        });
        return { result: 'OK' };
      }
      if (action === 'devicelist/DeleteDevice') {
        writes.push({ action, request: structuredClone(request) });
        const devices = state['devicelist/GetDevices3'].devices;
        devices.splice(
          devices.findIndex((item) => item.deviceID === request.deviceID),
          1,
        );
        return { result: 'OK' };
      }
      if (action === 'healthcheck/RunHealthCheck' || action === 'healthcheck/StopHealthCheck') {
        writes.push({ action, request: structuredClone(request) });
        state['healthcheck/GetHealthCheckStatus'] = action.endsWith('Run')
          ? {
              healthCheckModuleCurrentlyRunning: 'SpeedTest',
              speedTestResult: { resultID: 999, exitCode: 'Unavailable' },
            }
          : {};
        return { result: 'OK' };
      }
      if (/UpdateFirmwareNow|\/Refresh/.test(action)) {
        writes.push({ action, request: structuredClone(request) });
        return { result: 'OK' };
      }
      const keys = allowed[action];
      const unknown = keys ? Object.keys(request).find((key) => !keys.includes(key) && key !== 'settings') : null;
      if (unknown) {
        return { result: '_ErrorInvalidInput', error: `Encountered unexpected member "${unknown}" for element "X"` };
      }
      writes.push({ action, request: structuredClone(request) });
      if (action.startsWith('wirelessap/')) {
        request.radios.forEach((radio) => {
          const stored = state['wirelessap/GetRadioInfo'].radios.find((item) => item.radioID === radio.radioID);
          stored.settings = structuredClone(radio.settings);
        });
      } else {
        state[getFor(action)] = { ...state[getFor(action)], ...structuredClone(request) };
      }
      return { result: 'OK' };
    },
  };
}

export function createMockBackups() {
  const saved = [];
  return {
    saved,
    async save(entry) {
      saved.push(structuredClone(entry));
      return `backup-${saved.length}.json`;
    },
    async read() {
      return saved.at(-1);
    },
  };
}
