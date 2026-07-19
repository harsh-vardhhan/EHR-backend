import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/annotations';
import type { Document } from '../../types';

export function useDocuments() {
  return useQuery<Document[], Error>({
    queryKey: ['documents'],
    queryFn: api.getDocuments,
    select: (docs) => [...docs].sort((a, b) => a.id.localeCompare(b.id)),
  });
}

export function useDocument(id: string | undefined) {
  return useQuery<Document, Error>({
    queryKey: ['document', id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });
}
