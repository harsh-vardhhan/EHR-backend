import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/annotations';

export function useRelationships(documentId: string | undefined) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: api.createRelationship,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api.deleteRelationship(id, documentId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
  });

  return {
    createRelationship: createMutation.mutate,
    isCreating: createMutation.isPending,
    deleteRelationship: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
