export type { Document, Annotation, Relationship, AuditLog, Label } from '../../../backend/src/database/schemas';

// Re-export any other common front-end specific types if any
export type DocumentStatus = 'ready_for_review' | 'in_progress' | 'reviewed';
export type AnnotationStatus = 'suggested' | 'accepted' | 'rejected' | 'corrected';
export type AnnotationSource = 'human' | 'llm';
