import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMockRouter } from './mockRouter.js';
import { getSpeedTest, normalizeResult, startSpeedTest, stopSpeedTest } from './speedTestService.js';

const RESULTS = {
  healthCheckResults: [
    {
      resultID: 1,
      timestamp: '2021-01-01T00:00:00Z',
      speedTestResult: { exitCode: 'Success', latency: 8, uploadBandwidth: 20000, downloadBandwidth: 177709 },
    },
    {
      resultID: 2,
      timestamp: '2026-01-01T00:00:00Z',
      speedTestResult: { exitCode: 'SpeedTestExecutionError', latency: 0, uploadBandwidth: 0, downloadBandwidth: 0 },
    },
    { resultID: 3, timestamp: '2025-06-01T00:00:00Z', healthCheckModulesRequested: ['Other'] },
  ],
};

function createRouter(status = {}) {
  return createMockRouter({
    'healthcheck/GetHealthCheckStatus': status,
    'healthcheck/GetHealthCheckResults': RESULTS,
  });
}

test('normalizeResult turns kilobits per second into one-decimal megabits', () => {
  const result = normalizeResult(RESULTS.healthCheckResults[0]);
  assert.equal(result.downloadMbps, 177.7);
  assert.equal(result.uploadMbps, 20);
  assert.equal(result.isSuccess, true);
});

test('history is newest first, skips entries without a speed test, and finds the last good run', async () => {
  const test = await getSpeedTest(createRouter());
  assert.deepEqual(
    test.history.map((item) => item.id),
    [2, 1],
  );
  assert.equal(test.lastGood.id, 1);
  assert.equal(test.isRunning, false);
});

test('the status names the running module while a test is in progress', async () => {
  assert.equal((await getSpeedTest(createRouter({ healthCheckModuleCurrentlyRunning: 'SpeedTest' }))).isRunning, true);
});

test('startSpeedTest sends the request the router accepts: no fields at all', async () => {
  const router = createRouter();
  await startSpeedTest(router);
  assert.deepEqual(router.writes.at(-1), {
    action: 'healthcheck/RunHealthCheck',
    request: {},
  });
});

test('startSpeedTest refuses to start a second test while one is running', async () => {
  const router = createRouter({ healthCheckModuleCurrentlyRunning: 'SpeedTest' });
  await assert.rejects(startSpeedTest(router), { status: 409 });
  assert.equal(router.writes.length, 0);
});

test('a router that rejects the request has its message surfaced, and stop clears the status', async () => {
  const MockClient = {
    async callRaw(action) {
      return action.includes('Run')
        ? { result: '_ErrorInvalidInput', error: 'bad module' }
        : { result: 'OK', output: {} };
    },
  };
  await assert.rejects(startSpeedTest(MockClient), /bad module/);
  const router = createRouter({ healthCheckModuleCurrentlyRunning: 'SpeedTest' });
  await stopSpeedTest(router);
  assert.equal((await getSpeedTest(router)).isRunning, false);
});

test('the placeholder result the router lists while a test runs is hidden until the test finishes', async () => {
  const router = createMockRouter({
    'healthcheck/GetHealthCheckStatus': {
      healthCheckModuleCurrentlyRunning: 'SpeedTest',
      speedTestResult: { resultID: 999, exitCode: 'Unavailable' },
    },
    'healthcheck/GetHealthCheckResults': {
      healthCheckResults: [
        ...RESULTS.healthCheckResults,
        {
          resultID: 999,
          timestamp: '2026-11-12T20:00:06Z',
          speedTestResult: { exitCode: 'Unavailable', latency: 11, uploadBandwidth: 0, downloadBandwidth: 0 },
        },
      ],
    },
  });
  const test = await getSpeedTest(router);
  assert.equal(test.isRunning, true);
  assert.equal(
    test.history.some((item) => item.id === 999),
    false,
  );
  assert.equal(test.history[0].id, 2);
});
