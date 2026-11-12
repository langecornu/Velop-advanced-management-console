import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getOverview } from './diagnosticsService.js';

test('getOverview keeps working when one probe is unsupported by the firmware', async () => {
  const MockClient = {
    async callRaw(action) {
      return action.endsWith('GetSystemStats')
        ? { result: 'OK', output: { uptimeSeconds: 5 } }
        : { result: '_ErrorUnknownAction' };
    },
  };
  const overview = await getOverview(MockClient);
  assert.equal(overview['diagnostics/GetSystemStats'].output.uptimeSeconds, 5);
  assert.equal(overview['router/GetWANStatus3'].result, '_ErrorUnknownAction');
});
