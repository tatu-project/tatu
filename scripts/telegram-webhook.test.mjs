import test from 'node:test';
import assert from 'node:assert/strict';
import { setWebhook, webhookRequest } from './telegram-webhook.mjs';

const { Response } = globalThis;

const token = '123456789:' + 'A'.repeat(35),
  secret = 's'.repeat(40),
  valid = {
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_WEBHOOK_SECRET: secret,
    SITE_ORIGIN: 'https://tatu.example',
  };
test('webhook setup validates configuration without echoing secrets', () => {
  for (const overrides of [
    { TELEGRAM_BOT_TOKEN: undefined },
    { TELEGRAM_BOT_TOKEN: 'abc' },
    { TELEGRAM_WEBHOOK_SECRET: 'curto' },
    { TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(31) + '!' },
    { SITE_ORIGIN: 'http://tatu.example' },
    { SITE_ORIGIN: 'https://tatu.example/app' },
    { SITE_ORIGIN: undefined },
  ])
    assert.throws(
      () => webhookRequest({ ...valid, ...overrides }),
      (error) =>
        !error.message.includes(token) && !error.message.includes(secret),
    );
  assert.deepEqual(webhookRequest(valid).body, {
    url: 'https://tatu.example/api/telegram/webhook',
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
});
test('webhook setup posts once and redacts rejection details', async () => {
  const calls = [];
  const ok = async (url, init) => {
    calls.push({ url, init });
    return Response.json({ ok: true, result: true });
  };
  assert.equal(
    await setWebhook(valid, ok),
    'https://tatu.example/api/telegram/webhook',
  );
  assert.equal(calls[0].url, `https://api.telegram.org/bot${token}/setWebhook`);
  assert.equal(calls[0].init.redirect, 'error');
  await assert.rejects(
    setWebhook(valid, async () =>
      Response.json({ ok: false, description: `bad ${token} ${secret}` }),
    ),
    (error) =>
      !error.message.includes(token) &&
      !error.message.includes(secret) &&
      /recusou/u.test(error.message),
  );
  await assert.rejects(
    setWebhook(valid, async (url) => {
      throw new Error(`failed ${url}`);
    }),
    (error) => !error.message.includes(token),
  );
});
