// Plain-words verdict on whether the mesh nodes are up to date, from their update status and the update policy.
const DAY_MS = 24 * 3600 * 1000;

export function summarizeUpdates(nodes, schedules, now = Date.now()) {
  const pending = nodes.filter((node) => node.availableUpdate);
  const isAuto = schedules?.firmware.policy === 'AutomaticallyCheckAndInstall';
  const stale = nodes.filter((node) => !node.lastCheck || now - Date.parse(node.lastCheck) > 2 * DAY_MS);
  if (pending.length) {
    return {
      tone: 'info',
      text: `${pending.length} node${pending.length === 1 ? ' has' : 's have'} an update waiting: ${pending.map((node) => node.name).join(', ')}.${isAuto ? ' Automatic updates will install it in the update window.' : ''}`,
    };
  }
  if (schedules && !isAuto) {
    return { tone: 'bad', text: 'Automatic updates are off, so nodes only change when you update them yourself.' };
  }
  if (stale.length) {
    return {
      tone: 'bad',
      text: `${stale.map((node) => node.name).join(', ')} ${stale.length === 1 ? 'has' : 'have'} not checked for updates in two days.`,
    };
  }
  return {
    tone: 'ok',
    text: 'Every node checked for updates recently and none has one waiting, so they are up to date.',
  };
}
