import { describe, expect, it } from 'bun:test';
import { AuditService } from './audit.service';
import { AuditLogEntity } from '../database/entities';

describe('AuditService', () => {
  it('instantiates and provides getAuditLogs and createAuditLog methods', () => {
    const service = new AuditService();
    expect(typeof service.getAuditLogs).toBe('function');
    expect(typeof service.createAuditLog).toBe('function');
  });

  it('correctly handles empty query results gracefully without throwing', async () => {
    const originalQuery = AuditLogEntity.query;
    (AuditLogEntity as any).query = {
      primary: () => ({
        go: async () => ({ data: [] }),
      }),
    };

    try {
      const service = new AuditService();
      const logs = await service.getAuditLogs('doc-empty');
      expect(logs).toEqual([]);
    } finally {
      (AuditLogEntity as any).query = originalQuery;
    }
  });

  it('sorts audit logs chronologically ascending', async () => {
    const originalQuery = AuditLogEntity.query;
    const unsortedLogs = [
      {
        logId: '2',
        documentId: 'doc-sort',
        actionType: 'ANNOTATION_ACCEPTED',
        description: 'Second event',
        createdAt: '2026-01-02T10:00:00.000Z',
      },
      {
        logId: '1',
        documentId: 'doc-sort',
        actionType: 'INGESTION_COMPLETED',
        description: 'First event',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      {
        logId: '3',
        documentId: 'doc-sort',
        actionType: 'ANNOTATION_REJECTED',
        description: 'Third event',
        createdAt: '2026-01-03T10:00:00.000Z',
      },
    ];

    (AuditLogEntity as any).query = {
      primary: () => ({
        go: async () => ({ data: unsortedLogs }),
      }),
    };

    try {
      const service = new AuditService();
      const logs = await service.getAuditLogs('doc-sort');
      expect(logs.map((l) => l.logId)).toEqual(['1', '2', '3']);
    } finally {
      (AuditLogEntity as any).query = originalQuery;
    }
  });
});
