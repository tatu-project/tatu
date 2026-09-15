import type {
  BriefingResult,
  BriefingDraft,
  BriefingTask,
  ExecutionEvent,
  ExecutionRecord,
} from './index.js';

/** Database-independent persistence ports. Production storage remains undecided. */
export interface TaskStore {
  create(draft: BriefingDraft): BriefingTask;
  list(): BriefingTask[];
}

export interface ExecutionStore {
  listExecutions(): ExecutionRecord[];
  events(executionId: string): ExecutionEvent[] | undefined;
  briefing(executionId: string): BriefingResult | undefined;
}

export interface TatuStore extends TaskStore, ExecutionStore {
  close(): void;
}
