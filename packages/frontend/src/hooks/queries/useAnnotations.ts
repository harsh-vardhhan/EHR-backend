import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/annotations';
import type { Annotation } from '../../types';

export function useAnnotations(documentId: string | undefined) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: api.createAnnotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Annotation> }) => 
      api.updateAnnotation(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
  });

  return {
    createAnnotation: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateAnnotation: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
