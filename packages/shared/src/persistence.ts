import type {
  BriefingResult,
  BriefingDraft,
  BriefingTask,
  ExecutionEvent,
  ExecutionRecord,
} from './index.js';
import type { BriefingProposal, TaskPatch } from './assistant.js';

/** Database-independent persistence ports. Production storage remains undecided. */
export interface TaskStore {
  create(draft: BriefingDraft): BriefingTask;
  list(): BriefingTask[];
  update?(id: string, patch: TaskPatch): BriefingTask | undefined;
  propose?(
    draft: BriefingDraft,
    now?: Date,
    requestKey?: string,
  ): BriefingProposal;
  proposals?(now?: Date): BriefingProposal[];
  confirmProposal?(id: string, now?: Date): BriefingTask | undefined;
}

export interface ExecutionStore {
  /** Queue one manual execution for an existing task, idempotently by occurrence key. */
  enqueueManualExecution(
    taskId: string,
    occurrenceKey: string,
    scheduledFor: string,
  ): ExecutionRecord | undefined;
  listExecutions(): ExecutionRecord[];
  events(executionId: string): ExecutionEvent[] | undefined;
  briefing(executionId: string): BriefingResult | undefined;
}

export interface TatuStore extends TaskStore, ExecutionStore {
  close(): void;
}
