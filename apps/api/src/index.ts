import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import {
  getHealthStatus,
  hasTextSecret,
  hasSensitiveUrlQuery,
  redactTextSecrets,
  type SetupHealthStatus,
} from '@tatu/shared';
import { parseBriefing, type BriefingDraft } from '@tatu/shared';
import { renderHealthPage } from '@tatu/web';
import { SqliteTaskStore } from '@tatu/storage';
import type { TatuStore } from '@tatu/shared';

const publicExecution = (
  execution: Awaited<ReturnType<TatuStore['listExecutions']>>[number],
) => ({
  id: execution.id,
  taskId: execution.taskId,
  scheduledFor: execution.scheduledFor,
  status: execution.status,
  attempt: execution.attempt,
  maxAttempts: execution.maxAttempts,
  availableAt: execution.availableAt,
  leaseExpiresAt: execution.leaseExpiresAt,
  failure:
    execution.failure === null
      ? null
      : ['research_failure', 'model_failure', 'delivery_failure'].includes(
            execution.failure,
          )
        ? execution.failure
        : 'execution_failed',
  createdAt: execution.createdAt,
  updatedAt: execution.updatedAt,
});
const publicTask = (task: Awaited<ReturnType<TatuStore['list']>>[number]) => ({
  id: task.id,
  cadence: task.cadence,
  time: task.time,
  quantity: task.quantity,
  topic: redactTextSecrets(task.topic),
  deliveryRequested: task.deliveryRequested,
  timezone: task.timezone,
  enabled: task.enabled,
  createdAt: task.createdAt,
});
const publicEvents = (events: Awaited<ReturnType<TatuStore['events']>>) =>
  (events ?? []).map(({ type, at }) => ({ type, at, detail: null }));
const publicStory = (
  story: NonNullable<ReturnType<TatuStore['briefing']>>['stories'][number],
) => ({
  title: redactTextSecrets(story.title),
  url: (() => {
    try {
      const parsed = new URL(story.url);
      return parsed.username || parsed.password || hasSensitiveUrlQuery(parsed)
        ? '[REDACTED_URL]'
        : redactTextSecrets(story.url);
    } catch {
      return redactTextSecrets(story.url);
    }
  })(),
  publishedAt: redactTextSecrets(story.publishedAt),
  source: redactTextSecrets(story.source),
});
const publicBriefing = (
  result: NonNullable<ReturnType<TatuStore['briefing']>>,
) => {
  const publicResult: Record<string, unknown> = {
    topic: redactTextSecrets(result.topic),
    stories: result.stories.map(publicStory),
    facts: result.facts.map(publicStory),
    inference: result.inference.map(redactTextSecrets),
  };
  if (result.route !== undefined) publicResult.route = result.route;
  if (result.model !== undefined) {
    publicResult.model = {
      id: redactTextSecrets(result.model.id),
      route: result.model.route,
    };
  }
  if (result.fallback !== undefined) {
    publicResult.fallback = {
      from: result.fallback.from,
      reason: result.fallback.reason,
    };
  }
  if (result.observability !== undefined) {
    publicResult.observability = {
      provider: result.observability.provider,
      model:
        result.observability.model === null
          ? null
          : redactTextSecrets(result.observability.model),
      tools: [...result.observability.tools],
      latencyMs: result.observability.latencyMs,
      estimatedCost: { status: 'unknown' },
    };
  }
  if (result.delivery !== undefined) {
    publicResult.delivery = {
      channel: result.delivery.channel,
      artifactId: result.delivery.artifactId,
      contentSha256: result.delivery.contentSha256,
    };
  }
  return publicResult;
};

const drafts = new Map<string, BriefingDraft>();
export const getSetupHealthStatus = (
  repository: TatuStore,
  environment: NodeJS.ProcessEnv = process.env,
): SetupHealthStatus => {
  let tasks: ReturnType<TatuStore['list']> = [];
  let storageState: SetupHealthStatus['checks'][number]['state'] = 'healthy';
  let storageDetail = 'Task storage is readable.';
  try {
    tasks = repository.list();
  } catch {
    storageState = 'unavailable';
    storageDetail = 'Task storage is unavailable.';
  }

  const modelConfigured = Boolean(environment.TATU_OLLAMA_MODEL?.trim());
  const feeds = environment.TATU_RSS_FEEDS;
  const researchDisabled =
    feeds !== undefined &&
    feeds.split(',').every((feed) => feed.trim().length === 0);
  const nextTask = tasks.find(
    (task) =>
      task.enabled &&
      /^\d{2}:\d{2}$/u.test(task.time) &&
      typeof task.timezone === 'string' &&
      task.timezone.length > 0,
  );

  return {
    checks: [
      {
        id: 'agent',
        label: 'Agent online',
        state: 'healthy',
        detail: 'The API process is serving requests.',
      },
      {
        id: 'storage',
        label: 'Storage online',
        state: storageState,
        detail: storageDetail,
      },
      {
        id: 'ai-route',
        label: 'AI route available',
        state: 'configured',
        detail: modelConfigured
          ? 'A local model route is configured.'
          : 'The deterministic RSS route is configured.',
      },
      {
        id: 'research',
        label: 'Web research available',
        state: researchDisabled ? 'disabled' : 'configured',
        detail: researchDisabled
          ? 'Research is disabled by configuration.'
          : 'A public RSS research route is configured.',
      },
      {
        id: 'memory',
        label: 'Memory online',
        state: 'not_implemented',
        detail: 'Persistent memory is not implemented yet.',
      },
      {
        id: 'scheduler',
        label: 'Scheduler online',
        state: 'unknown',
        detail: 'Worker liveness is not exposed by the API yet.',
      },
    ],
    estimatedCost: { status: 'unknown' },
    nextTask: nextTask
      ? { time: nextTask.time, timezone: nextTask.timezone }
      : null,
  };
};
const json = (
  response: import('node:http').ServerResponse,
  status: number,
  body: unknown,
) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
};
const maxJsonBytes = 64 * 1024;
const maxIdempotencyKeyBytes = 256;
const hasControlCharacter = (value: string) =>
  [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
class BodyTooLargeError extends Error {}
const readJson = async (request: import('node:http').IncomingMessage) => {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (byteLength + bytes.length > maxJsonBytes) {
      request.resume();
      throw new BodyTooLargeError();
    }
    chunks.push(bytes);
    byteLength += bytes.length;
  }
  return JSON.parse(Buffer.concat(chunks, byteLength).toString('utf8')) as {
    message?: string;
    timezone?: string;
  };
};
export function createTatuServer(
  databasePath = process.env.TATU_DATABASE_PATH ?? 'data/tatu.sqlite',
  repository: TatuStore = new SqliteTaskStore(databasePath),
): Server {
  return createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/api/health') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify(getHealthStatus()));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/setup-health') {
      json(response, 200, getSetupHealthStatus(repository));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/tasks') {
      json(response, 200, repository.list().map(publicTask));
      return;
    }
    if (request.method === 'GET' && request.url === '/api/executions') {
      json(response, 200, repository.listExecutions().map(publicExecution));
      return;
    }
    const manual = request.url?.match(/^\/api\/tasks\/([^/]+)\/test$/);
    if (request.method === 'POST' && manual) {
      const rawKey = request.headers['idempotency-key'];
      const key = Array.isArray(rawKey) ? undefined : rawKey?.trim();
      if (
        !key ||
        Buffer.byteLength(key, 'utf8') > maxIdempotencyKeyBytes ||
        hasControlCharacter(key)
      ) {
        json(response, 400, {
          error: 'Idempotency-Key ausente ou inválida (máximo de 256 bytes).',
        });
        return;
      }
      const task = repository.list().find((item) => item.id === manual[1]);
      if (!task) {
        json(response, 404, { error: 'Tarefa não encontrada.' });
        return;
      }
      const occurrenceKey = `manual:${createHash('sha256')
        .update(`${task.id}\u0000${key}`)
        .digest('hex')}`;
      const execution = repository.enqueueManualExecution(
        task.id,
        occurrenceKey,
        new Date().toISOString(),
      );
      if (!execution) {
        json(response, 404, { error: 'Tarefa não encontrada.' });
        return;
      }
      json(response, 202, publicExecution(execution));
      return;
    }
    const executionEvents = request.url?.match(
      /^\/api\/executions\/([^/]+)\/events$/,
    );
    if (request.method === 'GET' && executionEvents) {
      json(response, 200, publicEvents(repository.events(executionEvents[1])));
      return;
    }
    const briefing = request.url?.match(
      /^\/api\/executions\/([^/]+)\/briefing$/,
    );
    if (request.method === 'GET' && briefing) {
      const result = repository.briefing(briefing[1]);
      if (!result) {
        json(response, 404, { error: 'Briefing não encontrado.' });
        return;
      }
      json(response, 200, publicBriefing(result));
      return;
    }

    if (request.method === 'POST' && request.url === '/api/briefing-drafts') {
      readJson(request)
        .then(({ message, timezone }) => {
          if (typeof message !== 'string' || typeof timezone !== 'string') {
            json(response, 422, {
              clarification: 'Informe mensagem e fuso horário.',
            });
            return;
          }
          const parsed = parseBriefing(message, timezone);
          if (!parsed.ok) {
            json(response, 422, parsed);
            return;
          }
          if (hasTextSecret(parsed.draft.topic)) {
            json(response, 422, {
              clarification:
                'O tema parece conter uma credencial; informe apenas o tema.',
            });
            return;
          }
          const draftId = crypto.randomUUID();
          drafts.set(draftId, parsed.draft);
          json(response, 201, { draftId, confirmation: parsed.draft });
        })
        .catch((error: unknown) =>
          json(
            response,
            error instanceof BodyTooLargeError ? 413 : 400,
            error instanceof BodyTooLargeError
              ? { error: 'Corpo JSON excede 64 KiB.' }
              : { error: 'JSON inválido.' },
          ),
        );
      return;
    }
    const confirm = request.url?.match(
      /^\/api\/briefing-drafts\/([^/]+)\/confirm$/,
    );
    if (request.method === 'POST' && confirm) {
      const draft = drafts.get(confirm[1]);
      if (!draft) {
        json(response, 409, {
          error: 'Rascunho inexistente ou já confirmado.',
        });
        return;
      }
      drafts.delete(confirm[1]);
      json(response, 201, repository.create(draft));
      return;
    }

    if (request.method === 'GET' && request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderHealthPage());
      return;
    }

    response.writeHead(404, {
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ error: 'Not found' }));
  }).on('close', () => repository.close());
}

function start(): void {
  const port = Number(process.env.PORT ?? 3000);
  const server = createTatuServer();

  server.listen(port, () => {
    console.log(`Tatu API listening on http://localhost:${port}`);
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  start();
}
