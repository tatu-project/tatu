import process from 'node:process';
import console from 'node:console';
import { resolve } from 'node:path';
import { pathToFileURL, URL } from 'node:url';

const { fetch, AbortSignal } = globalThis;

/** Builds the setWebhook call; error messages never include secret values. */
export function webhookRequest(environment = {}) {
  const token = environment.TELEGRAM_BOT_TOKEN,
    secret = environment.TELEGRAM_WEBHOOK_SECRET;
  if (
    typeof token !== 'string' ||
    !/^\d{1,20}:[A-Za-z0-9_-]{30,100}$/u.test(token)
  )
    throw new Error('TELEGRAM_BOT_TOKEN ausente ou inválido.');
  if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/u.test(secret))
    throw new Error(
      'TELEGRAM_WEBHOOK_SECRET precisa ter de 32 a 256 caracteres A-Z, a-z, 0-9, _ ou -.',
    );
  let origin;
  try {
    origin = new URL(String(environment.SITE_ORIGIN ?? ''));
  } catch {
    origin = null;
  }
  if (
    !origin ||
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('SITE_ORIGIN precisa ser uma origem HTTPS sem caminho.');
  return {
    url: `https://api.telegram.org/bot${token}/setWebhook`,
    body: {
      url: `${origin.origin}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    },
  };
}
export async function setWebhook(environment, fetcher = fetch) {
  const request = webhookRequest(environment);
  let result;
  try {
    const response = await fetcher(request.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request.body),
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    result = await response.json();
  } catch {
    throw new Error('Não foi possível falar com a API do Telegram.');
  }
  if (result?.ok !== true)
    throw new Error(
      `O Telegram recusou o webhook: ${String(
        result?.description ?? 'sem detalhe',
      )
        .split(environment.TELEGRAM_BOT_TOKEN)
        .join('[token]')
        .split(environment.TELEGRAM_WEBHOOK_SECRET)
        .join('[segredo]')
        .slice(0, 200)}`,
    );
  return request.body.url;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const url = await setWebhook(process.env);
    console.log(`Webhook do Telegram configurado para ${url}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Falha.');
    process.exitCode = 1;
  }
}
