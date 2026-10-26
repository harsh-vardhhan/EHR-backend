import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/annotations';
import { toast } from '../../components/ui/toast';
import type { Annotation } from '../../types';

export function useAnnotations(documentId: string | undefined) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: api.createAnnotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create annotation');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Annotation> }) => 
      api.updateAnnotation(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update annotation');
    },
  });

  return {
    createAnnotation: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateAnnotation: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
