import { describe, expect, it, mock } from 'bun:test';
import { AnnotationsService } from './annotations.service';
import type { AuditService } from './audit.service';
import type { RelationshipsService } from './relationships.service';

const UUID_V5_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('AnnotationsService', () => {
  const mockAudit = {
    getAuditLogs: mock(async () => []),
    createAuditLog: mock(async () => undefined),
  } as unknown as AuditService;

  const mockRelationships = {
    getRelationshipsByDocument: mock(async () => []),
    createRelationship: mock(async () => ({} as any)),
    createRelationships: mock(async () => []),
    deleteRelationship: mock(async () => {}),
    deleteRelationshipsByAnnotation: mock(async () => 0),
  } as unknown as RelationshipsService;

  const service = new AnnotationsService(mockAudit, mockRelationships);

  describe('Deterministic UUID v5 Generation', () => {
    it('produces a RFC4122 compliant UUID v5 string', () => {
      const uuid = service.generateDeterministicUuid(
        'doc-123',
        10,
        25,
        'Medication',
      );
      expect(uuid).toMatch(UUID_V5_REGEX);
    });

    it('produces identical UUIDs for identical inputs (100% deterministic)', () => {
      const uuid1 = service.generateDeterministicUuid(
        'doc-abc',
        100,
        120,
        'Dosage',
      );
      const uuid2 = service.generateDeterministicUuid(
        'doc-abc',
        100,
        120,
        'Dosage',
      );
      expect(uuid1).toBe(uuid2);
    });

    it('produces distinct UUIDs when documentId, span offsets, or label differ', () => {
      const base = service.generateDeterministicUuid(
        'doc-1',
        0,
        10,
        'Medication',
      );
      const diffDoc = service.generateDeterministicUuid(
        'doc-2',
        0,
        10,
        'Medication',
      );
      const diffStart = service.generateDeterministicUuid(
        'doc-1',
        1,
        10,
        'Medication',
      );
      const diffEnd = service.generateDeterministicUuid(
        'doc-1',
        0,
        11,
        'Medication',
      );
      const diffLabel = service.generateDeterministicUuid(
        'doc-1',
        0,
        10,
        'Condition',
      );

      expect(base).not.toBe(diffDoc);
      expect(base).not.toBe(diffStart);
      expect(base).not.toBe(diffEnd);
      expect(base).not.toBe(diffLabel);
    });
  });

  describe('Delegation to Subordinate Services', () => {
    it('delegates getAuditLogs to AuditService', async () => {
      await service.getAuditLogs('doc-test');
      expect(mockAudit.getAuditLogs).toHaveBeenCalledWith('doc-test');
    });

    it('delegates createAuditLog to AuditService', async () => {
      await service.createAuditLog('doc-test', 'TEST_ACTION', 'Test description');
      expect(mockAudit.createAuditLog).toHaveBeenCalledWith(
        'doc-test',
        'TEST_ACTION',
        'Test description',
      );
    });

    it('delegates getRelationshipsByDocument to RelationshipsService', async () => {
      await service.getRelationshipsByDocument('doc-test');
      expect(mockRelationships.getRelationshipsByDocument).toHaveBeenCalledWith(
        'doc-test',
      );
    });

    it('delegates deleteRelationshipsByAnnotation to RelationshipsService', async () => {
      await service.deleteRelationshipsByAnnotation('doc-test', 'ann-123');
      expect(
        mockRelationships.deleteRelationshipsByAnnotation,
      ).toHaveBeenCalledWith('doc-test', 'ann-123');
    });
  });
});
