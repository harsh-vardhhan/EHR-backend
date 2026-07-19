import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/annotations';
import type { AuditLog } from '../../types/audit';

export function useAuditLogs(documentId: string | undefined) {
  return useQuery<AuditLog[], Error>({
    queryKey: ['auditLogs', documentId],
    queryFn: () => api.getAuditLogs(documentId!),
    enabled: !!documentId && documentId !== 'preview',
    refetchInterval: 3000, // Poll every 3 seconds to keep audit timeline synced in real-time
  });
}
