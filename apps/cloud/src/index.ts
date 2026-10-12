import { renderHealthPage, pwaAssets } from '@tatu/web';
import {
  authenticate,
  permitsCloudMutation,
  permitsSystemRun,
} from './auth.js';
import { createRemoteServices } from './providers.js';
import { handleMcp } from './mcp.js';
import { runDue } from './scheduler.js';
import { WorkspaceStore, ownerForIdentity } from './storage.js';
import { failure, handleWorkspace, json, proposeMessage } from './workspace.js';
import type {
  Authenticate,
  CloudContext,
  CloudEnv,
  RemoteServices,
} from './types.js';

const secure = (response: Response, nonce?: string): Response => {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-frame-options', 'DENY');
  headers.set(
    'content-security-policy',
    `default-src 'self'; script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
  );
  headers.set('strict-transport-security', 'max-age=31536000');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
export interface CloudDependencies {
  authenticate?: Authenticate;
  services?: (env: CloudEnv) => RemoteServices;
}
/** Tests inject identity here; production never reads a body/header owner override. */
export function createCloudWorker(dependencies: CloudDependencies = {}) {
  const resolveIdentity = dependencies.authenticate ?? authenticate;
  return {
    async fetch(
      request: Request,
      env: CloudEnv,
      _context?: CloudContext,
    ): Promise<Response> {
      try {
        void _context;
        const url = new URL(request.url);
        const mutation = !['GET', 'HEAD'].includes(request.method);
        if (
          (mutation ||
            ((url.pathname.startsWith('/api/') || url.pathname === '/mcp') &&
              (request.headers.has('origin') ||
                request.headers.has('sec-fetch-site')))) &&
          !permitsCloudMutation(request, env)
        )
          return secure(json({ error: 'Origem da ação não permitida.' }, 403));
        if (
          ['POST', 'PATCH'].includes(request.method) &&
          url.pathname !== '/api/system/run-due' &&
          request.headers
            .get('content-type')
            ?.split(';')[0]
            .trim()
            .toLowerCase() !== 'application/json'
        )
          return secure(json({ error: 'Use uma requisição JSON.' }, 415));
        if (url.pathname === '/api/system/run-due') {
          if (request.method !== 'POST' || !permitsSystemRun(request, env))
            return secure(json({ error: 'Acesso não autorizado.' }, 401));
          if (!env.DB)
            return secure(
              json({ error: 'Armazenamento online indisponível.' }, 503),
            );
          await runDue(env);
          return secure(json({ dispatched: true }));
        }
        if (request.method === 'GET' && url.pathname === '/') {
          const bytes = crypto.getRandomValues(new Uint8Array(18));
          const nonce = btoa(String.fromCharCode(...bytes));
          return secure(
            new Response(
              renderHealthPage().replace(
                /<script>/gu,
                `<script nonce="${nonce}">`,
              ),
              { headers: { 'content-type': 'text/html; charset=utf-8' } },
            ),
            nonce,
          );
        }
        if (request.method === 'GET' && pwaAssets[url.pathname]) {
          const asset = pwaAssets[url.pathname];
          return secure(
            new Response(asset.body, {
              headers: { 'content-type': asset.contentType },
            }),
          );
        }
        if (request.method === 'GET' && url.pathname === '/api/health')
          return secure(
            json({
              service: 'tatu',
              stage: 'online-workspace',
              status: env.DB ? 'configured' : 'unavailable',
            }),
          );
        const identity = await resolveIdentity(request, env);
        if (url.pathname === '/mcp') {
          if (!identity)
            return secure(await handleMcp(request, env, null, null));
          if (!env.DB)
            return secure(
              json({ error: 'Armazenamento online indisponível.' }, 503),
            );
          const owner = await ownerForIdentity(env.DB, identity);
          const store = new WorkspaceStore(env.DB, owner);
          if (!(await store.consumeApiBudget(mutation)))
            return secure(
              json(
                { error: 'Muitas solicitações. Tente novamente em um minuto.' },
                429,
              ),
            );
          return secure(
            await handleMcp(request, env, owner, {
              listTasks: () => store.listTasks(),
              listExecutions: () => store.listExecutions(),
              briefing: (id) => store.briefing(id),
              notes: (query) => store.notes(query),
              memories: () => store.memories(),
              propose: (message, timezone) =>
                proposeMessage(store, message, timezone),
            }),
          );
        }
        if (!identity)
          return secure(
            json({ error: 'Entre na sua conta para acessar o Tatu.' }, 401),
          );
        if (!env.DB)
          return secure(
            json({ error: 'Armazenamento online indisponível.' }, 503),
          );
        const owner = await ownerForIdentity(env.DB, identity),
          store = new WorkspaceStore(env.DB, owner),
          services = (dependencies.services ?? createRemoteServices)(env);
        if (!(await store.consumeApiBudget(mutation)))
          return secure(
            json(
              { error: 'Muitas solicitações. Tente novamente em um minuto.' },
              429,
            ),
          );
        return secure(await handleWorkspace(request, env, store, services));
      } catch (error) {
        return secure(failure(error));
      }
    },
    async scheduled(
      controller: { scheduledTime?: number },
      env: CloudEnv,
      context: CloudContext,
    ): Promise<void> {
      context.waitUntil(
        runDue(
          env,
          controller.scheduledTime === undefined
            ? new Date()
            : new Date(controller.scheduledTime),
        ),
      );
    },
  };
}
export default createCloudWorker();
