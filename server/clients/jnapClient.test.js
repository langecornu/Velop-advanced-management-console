import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJnapClient, redact } from './jnapClient.js';

function createClient(payload) {
  const requests = [];
  const MockFetch = async (url, options) => {
    requests.push({ url, options });
    return { json: async () => payload };
  };
  const client = createJnapClient({
    host: '192.168.1.1',
    user: 'admin',
    password: 'secret',
    timeoutMs: 1000,
    fetchImpl: MockFetch,
  });
  return { client, requests };
}

test('call sends the action and basic auth headers and returns the output', async () => {
  const { client, requests } = createClient({ result: 'OK', output: { a: 1 } });
  assert.deepEqual(await client.call('router/GetLANSettings'), { a: 1 });
  assert.equal(requests[0].options.headers['X-JNAP-Action'], 'http://linksys.com/jnap/router/GetLANSettings');
  assert.match(requests[0].options.headers['X-JNAP-Authorization'], /^Basic /);
});

test('call maps unauthorized to a safe 502 that does not contain the credentials', async () => {
  const { client } = createClient({
    result: '_ErrorUnauthorized',
    error: "Invalid authorization credentials 'Basic YWRtaW46c2VjcmV0'",
  });
  await assert.rejects(client.call('router/GetLANSettings'), (error) => {
    assert.equal(error.status, 502);
    assert.equal(JSON.stringify(error).includes('YWRtaW46'), false);
    return true;
  });
});

test('redact strips an echoed Authorization header from error text', () => {
  assert.equal(
    redact({ error: "bad 'Basic YWJj='" }).error,
    "bad '[redacted]'".replace('[redacted]', 'Basic [redacted]'),
  );
});

test('callRaw never exposes the echoed credentials either', async () => {
  const { client } = createClient({ result: '_ErrorUnauthorized', error: "x 'Basic YWRtaW46c2VjcmV0'" });
  assert.equal((await client.callRaw('a/GetB')).error.includes('YWRtaW46'), false);
});

test('call reports a timeout or network failure as a 504', async () => {
  const MockFetch = async () => {
    throw new DOMException('timed out', 'TimeoutError');
  };
  const client = createJnapClient({ host: 'x', user: 'a', password: 'b', timeoutMs: 1000, fetchImpl: MockFetch });
  await assert.rejects(client.call('core/GetDeviceInfo'), { status: 504 });
});

test('after one unauthorized answer the client refuses to contact the router again', async () => {
  const { client, requests } = createClient({ result: '_ErrorUnauthorized', error: 'nope' });
  await assert.rejects(client.call('router/GetLANSettings'), { status: 502 });
  await assert.rejects(client.call('router/GetLANSettings'), { status: 503 });
  assert.equal(requests.length, 1, 'only the first request may reach the router');
});

test('transaction reads the per-action responses from the top level, as the real router sends them', async () => {
  const { client } = createClient({
    result: 'OK',
    responses: [{ result: 'OK', output: { a: 1 } }, { result: '_ErrorUnknownAction' }],
  });
  const results = await client.transaction([{ action: 'x/GetA' }, { action: 'x/GetB' }]);
  assert.deepEqual(
    results.map((item) => item.result),
    ['OK', '_ErrorUnknownAction'],
  );
  assert.deepEqual(results[0].output, { a: 1 });
});

test('a failed action puts the router error text in the message so the cause is visible', async () => {
  const { client } = createClient({ result: '_ErrorInvalidInput', error: 'unexpected element "foo"' });
  await assert.rejects(client.call('router/SetLANSettings', {}), /_ErrorInvalidInput - unexpected element "foo"/);
});
