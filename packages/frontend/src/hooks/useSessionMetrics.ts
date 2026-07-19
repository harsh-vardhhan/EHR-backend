import type { Annotation } from '../types/annotation';
import { ANNOTATION_STATUS, ANNOTATION_SOURCE } from '../constants/status';

export function useSessionMetrics(annotations: Annotation[]) {
  const llmAnnotations = annotations.filter(a => a.source === ANNOTATION_SOURCE.LLM);
  const suggestionsCount = llmAnnotations.length;
  
  const acceptedCount = annotations.filter(a => a.status === ANNOTATION_STATUS.ACCEPTED).length;
  const rejectedCount = annotations.filter(a => a.status === ANNOTATION_STATUS.REJECTED).length;
  
  const totalReviewed = acceptedCount + rejectedCount;
  const accuracy = totalReviewed > 0 ? Math.round((acceptedCount / totalReviewed) * 100) : 0;

  const getLabelCount = (label: string) => 
    annotations.filter(a => a.label === label && a.status !== ANNOTATION_STATUS.REJECTED).length;

  return {
    suggestionsCount,
    acceptedCount,
    rejectedCount,
    totalReviewed,
    accuracy,
    getLabelCount,
  };
}
