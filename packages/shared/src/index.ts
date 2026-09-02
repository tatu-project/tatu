export const healthStatus = {
  service: 'tatu',
  stage: 'technical-foundation',
  status: 'healthy',
} as const;

export type HealthStatus = typeof healthStatus;

export function getHealthStatus(): HealthStatus {
  return healthStatus;
}

export interface BriefingDraft {
  cadence: 'daily';
  time: string;
  quantity: number;
  topic: string;
  deliveryRequested: true;
  timezone: string;
}

export interface BriefingTask extends BriefingDraft {
  id: string;
  enabled: true;
  createdAt: string;
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');

export function parseBriefing(
  message: string,
  timezone: string,
): { ok: true; draft: BriefingDraft } | { ok: false; clarification: string } {
  const normalized = normalize(message);
  if (!Intl.supportedValuesOf('timeZone').includes(timezone)) {
    return {
      ok: false,
      clarification:
        'Informe um fuso horário IANA válido, como America/Sao_Paulo.',
    };
  }
  const match = normalized.match(
    /todos os dias\s+as\s+(\d{1,2})(?::|h)(\d{2})?[,.]?\s*encontre as\s+(\d+|tres)\s+noticias mais importantes sobre\s+(.+?)\s+e me envie/,
  );
  if (!match) {
    return {
      ok: false,
      clarification:
        'Esclareça recorrência diária, horário, quantidade, tema e intenção de envio.',
    };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const quantity = match[3] === 'tres' ? 3 : Number(match[3]);
  const normalizedTopic = match[4].replace(/[.!?]+$/, '').trim();
  const topic =
    normalizedTopic === 'inteligencia artificial'
      ? 'inteligência artificial'
      : normalizedTopic;
  if (hour > 23 || minute > 59 || quantity < 1 || !topic) {
    return {
      ok: false,
      clarification:
        'Informe horário, quantidade e tema válidos para a tarefa.',
    };
  }
  return {
    ok: true,
    draft: {
      cadence: 'daily',
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      quantity,
      topic,
      deliveryRequested: true,
      timezone,
    },
  };
}
