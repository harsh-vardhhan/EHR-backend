import { describe, expect, it, mock } from 'bun:test';
import { RelationshipsService } from './relationships.service';
import type { AuditService } from './audit.service';
import { RelationshipEntity, DocumentEntity } from '../database/entities';

describe('RelationshipsService', () => {
  const mockAudit = {
    getAuditLogs: mock(async () => []),
    createAuditLog: mock(async () => undefined),
  } as unknown as AuditService;

  it('instantiates properly with injected audit service', () => {
    const service = new RelationshipsService(mockAudit);
    expect(service).toBeDefined();
    expect(typeof service.getRelationshipsByDocument).toBe('function');
    expect(typeof service.deleteRelationshipsByAnnotation).toBe('function');
  });

  it('returns 0 and does not error if no relationships match annotationId during cascade deletion', async () => {
    const originalQuery = RelationshipEntity.query;
    (RelationshipEntity as any).query = {
      primary: () => ({
        go: async () => ({
          data: [
            {
              relationshipId: 'rel-1',
              documentId: 'doc-1',
              sourceAnnotationId: 'ann-other-1',
              targetAnnotationId: 'ann-other-2',
            },
          ],
        }),
      }),
    };

    try {
      const service = new RelationshipsService(mockAudit);
      const deletedCount = await service.deleteRelationshipsByAnnotation('doc-1', 'ann-target');
      expect(deletedCount).toBe(0);
    } finally {
      (RelationshipEntity as any).query = originalQuery;
    }
  });

  it('deletes linked relationships when source or target matches annotationId', async () => {
    const originalQuery = RelationshipEntity.query;
    const originalDelete = RelationshipEntity.delete;

    const mockDelete = mock(() => ({
      go: async () => ({}),
    }));

    (RelationshipEntity as any).query = {
      primary: () => ({
        go: async () => ({
          data: [
            {
              relationshipId: 'rel-1',
              documentId: 'doc-1',
              sourceAnnotationId: 'ann-target',
              targetAnnotationId: 'ann-2',
            },
            {
              relationshipId: 'rel-2',
              documentId: 'doc-1',
              sourceAnnotationId: 'ann-3',
              targetAnnotationId: 'ann-target',
            },
            {
              relationshipId: 'rel-3',
              documentId: 'doc-1',
              sourceAnnotationId: 'ann-4',
              targetAnnotationId: 'ann-5',
            },
          ],
        }),
      }),
    };
    (RelationshipEntity as any).delete = mockDelete;

    try {
      const service = new RelationshipsService(mockAudit);
      const deletedCount = await service.deleteRelationshipsByAnnotation('doc-1', 'ann-target');
      expect(deletedCount).toBe(2);
      expect(mockDelete).toHaveBeenCalledTimes(2);
      expect(mockAudit.createAuditLog).toHaveBeenCalledWith(
        'doc-1',
        'CASCADING_RELATIONSHIPS_DELETED',
        'Cleaned up 2 linked relationships due to annotation ann-target deletion.',
      );
    } finally {
      (RelationshipEntity as any).query = originalQuery;
      (RelationshipEntity as any).delete = originalDelete;
    }
  });

  it('throws an error when creating relationship for a non-existent document', async () => {
    const originalDocGet = DocumentEntity.get;
    (DocumentEntity as any).get = () => ({
      go: async () => ({ data: null }),
    });

    try {
      const service = new RelationshipsService(mockAudit);
      expect(
        service.createRelationship({
          documentId: 'missing-doc',
          sourceAnnotationId: 'src-1',
          targetAnnotationId: 'tgt-1',
          relationType: 'treats',
        }),
      ).rejects.toThrow('Document with id missing-doc not found');
    } finally {
      (DocumentEntity as any).get = originalDocGet;
    }
  });
});
