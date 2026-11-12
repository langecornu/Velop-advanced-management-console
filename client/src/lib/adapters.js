// Reshapes a few verbose router responses into flat, friendly rows before they are displayed.
function adaptDevices(output) {
  return {
    revision: output.revision,
    devices: output.devices.map((device) => {
      const connection = device.connections?.[0];
      const iface = device.knownInterfaces?.[0];
      return {
        name: device.friendlyName,
        type: device.model?.deviceType,
        manufacturer: device.model?.manufacturer,
        model: device.model?.modelNumber,
        ipAddress: connection?.ipAddress,
        macAddress: iface?.macAddress,
        connected: Boolean(connection),
        interface: iface?.interfaceType,
        band: iface?.band,
        isGuest: connection?.isGuest,
      };
    }),
  };
}

const ADAPTERS = {
  'devicelist/GetDevices3': (output) => (Array.isArray(output?.devices) ? adaptDevices(output) : output),
};

export function adaptOutput(action, output) {
  const short = String(action ?? '').replace('http://linksys.com/jnap/', '');
  return ADAPTERS[short] ? ADAPTERS[short](output) : output;
}
