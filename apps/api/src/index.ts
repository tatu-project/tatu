import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';

import { getHealthStatus } from '@tatu/shared';
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
  failure: execution.failure,
  createdAt: execution.createdAt,
  updatedAt: execution.updatedAt,
});
const publicEvents = (events: Awaited<ReturnType<TatuStore['events']>>) =>
  (events ?? []).map(({ type, at }) => ({ type, at, detail: null }));
const publicStory = (
  story: NonNullable<ReturnType<TatuStore['briefing']>>['stories'][number],
) => ({
  title: story.title,
  url: story.url,
  publishedAt: story.publishedAt,
  source: story.source,
});
const publicBriefing = (
  result: NonNullable<ReturnType<TatuStore['briefing']>>,
) => {
  const publicResult: Record<string, unknown> = {
    topic: result.topic,
    stories: result.stories.map(publicStory),
    facts: result.facts.map(publicStory),
    inference: result.inference,
  };
  if (result.route !== undefined) publicResult.route = result.route;
  if (result.model !== undefined) {
    publicResult.model = { id: result.model.id, route: result.model.route };
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
      model: result.observability.model,
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

    if (request.method === 'GET' && request.url === '/api/tasks') {
      json(response, 200, repository.list());
      return;
    }
    if (request.method === 'GET' && request.url === '/api/executions') {
      json(response, 200, repository.listExecutions().map(publicExecution));
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
