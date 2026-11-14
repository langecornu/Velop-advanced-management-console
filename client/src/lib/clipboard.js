// Copies text on any origin. navigator.clipboard only exists on https or localhost, and this tool is usually opened
// over plain http from another device, so fall back to the older selection-based copy there.
export async function copyText(text) {
  if (globalThis.navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    if (!document.execCommand('copy')) {
      throw new Error('Copy was refused by the browser');
    }
  } finally {
    area.remove();
  }
}
