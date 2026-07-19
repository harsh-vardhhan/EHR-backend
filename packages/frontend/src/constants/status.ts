/**
 * Centralized domain status constants.
 */
export const ANNOTATION_STATUS = {
  SUGGESTED: 'suggested',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const;

export const DOCUMENT_STATUS = {
  READY: 'ready_for_review',
  IN_PROGRESS: 'in_progress',
  REVIEWED: 'reviewed',
} as const;

export const ANNOTATION_SOURCE = {
  HUMAN: 'human',
  LLM: 'llm',
} as const;
