import { createHash } from 'crypto';
import { MEDICAL_ENTITIES, type MedicalEntityLabel } from '../constants/labels';
import { AnnotationEntity } from '../database/annotations.entity';
import { DocumentEntity } from '../database/documents.entity';
import type { Annotation, Relationship, AuditLog } from '../database/schemas';
import { auditService, type AuditService } from './audit.service';
import { relationshipsService, type RelationshipsService } from './relationships.service';

export type { Annotation, Relationship, AuditLog };

export class AnnotationsService {
  private audit: AuditService;
  private relationships: RelationshipsService;

  constructor(
    audit: AuditService = auditService,
    relationships: RelationshipsService = relationshipsService,
  ) {
    this.audit = audit;
    this.relationships = relationships;
  }

  /**
   * Generates a 100% deterministic UUID v5-compatible string derived from the entity span.
   * Ensures native DynamoDB uniqueness on (documentId, startOffset, endOffset, label)
   * with zero race conditions and zero extra read query overhead.
   */
  public generateDeterministicUuid(
    documentId: string,
    startOffset: number,
    endOffset: number,
    label: string,
  ): string {
    const input = `${documentId}:${startOffset}:${endOffset}:${label}`;
    const hash = createHash('sha256').update(input).digest('hex');
    const timeLow = hash.substring(0, 8);
    const timeMid = hash.substring(8, 12);
    const timeHiAndVersion = '5' + hash.substring(13, 16);
    const clockSeq = '8' + hash.substring(17, 20);
    const node = hash.substring(20, 32);
    return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeq}-${node}`;
  }

  async getAnnotationsByDocument(documentId: string): Promise<Annotation[]> {
    const response = await AnnotationEntity.query.primary({ documentId }).go();
    return (response.data || []).map((item) => ({
      ...item,
      id: item.annotationId,
    }));
  }

  async createAnnotation(
    data: Omit<Annotation, 'annotationId' | 'createdAt' | 'id'>,
  ): Promise<Annotation> {
    // Check if document exists in the single table
    const docRes = await DocumentEntity.get({ id: data.documentId }).go();
    if (!docRes.data) {
      throw new Error(`Document with id ${data.documentId} not found`);
    }

    // Check for duplicate tuple (handles both legacy random-ID and new deterministic-ID records)
    const existingAnnotations = await this.getAnnotationsByDocument(
      data.documentId,
    );
    const isDuplicate = existingAnnotations.some(
      (existing) =>
        existing.startOffset === data.startOffset &&
        existing.endOffset === data.endOffset &&
        existing.label === data.label,
    );

    if (isDuplicate) {
      throw new Error(
        `An annotation for label "${data.label}" at offsets [${data.startOffset}-${data.endOffset}] already exists for document ${data.documentId}`,
      );
    }

    // Deterministic UUID based on documentId, span offsets, and label
    const annotationId = this.generateDeterministicUuid(
      data.documentId,
      data.startOffset,
      data.endOffset,
      data.label,
    );

    const entityPayload = { ...data };
    const newAnnotation = {
      ...entityPayload,
      annotationId,
      createdAt: new Date().toISOString(),
    };

    try {
      await AnnotationEntity.create(newAnnotation).go();
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      if (
        errorMsg.includes('already exists') ||
        errorMsg.includes('ConditionalCheckFailedException')
      ) {
        throw new Error(
          `An annotation for label "${data.label}" at offsets [${data.startOffset}-${data.endOffset}] already exists for document ${data.documentId}`,
        );
      }
      throw error;
    }

    await this.audit.createAuditLog(
      data.documentId,
      'ANNOTATION_CREATED',
      `Clinician manually created ${data.label} annotation: "${data.text}"`,
    );
    return {
      ...newAnnotation,
      source: newAnnotation.source,
      status: newAnnotation.status,
      label: newAnnotation.label,
      assertion: newAnnotation.assertion,
      id: annotationId,
    };
  }

  async createAnnotations(
    documentId: string,
    annotationsData: Omit<
      Annotation,
      'annotationId' | 'createdAt' | 'documentId' | 'id'
    >[],
  ): Promise<Annotation[]> {
    if (annotationsData.length === 0) return [];

    const docRes = await DocumentEntity.get({ id: documentId }).go();
    if (!docRes.data) {
      throw new Error(`Document with id ${documentId} not found`);
    }

    const existingAnnotations = await this.getAnnotationsByDocument(documentId);
    const existingIds = new Set(
      existingAnnotations.map((ann) => ann.annotationId),
    );
    const existingTupleKeys = new Set(
      existingAnnotations.map(
        (ann) => `${ann.startOffset}:${ann.endOffset}:${ann.label}`,
      ),
    );

    const timestamp = new Date().toISOString();
    const seenUuids = new Set<string>();
    const seenTupleKeys = new Set<string>();

    const uniqueAnnotations = annotationsData
      .map((data) => {
        const annotationId = this.generateDeterministicUuid(
          documentId,
          data.startOffset,
          data.endOffset,
          data.label,
        );
        return {
          ...data,
          documentId,
          annotationId,
          createdAt: timestamp,
        };
      })
      .filter((ann) => {
        const tupleKey = `${ann.startOffset}:${ann.endOffset}:${ann.label}`;
        if (
          seenUuids.has(ann.annotationId) ||
          existingIds.has(ann.annotationId) ||
          seenTupleKeys.has(tupleKey) ||
          existingTupleKeys.has(tupleKey)
        ) {
          return false;
        }
        seenUuids.add(ann.annotationId);
        seenTupleKeys.add(tupleKey);
        return true;
      });

    if (uniqueAnnotations.length === 0) return [];

    const createdAnnotations: Annotation[] = [];
    const unexpectedErrors: Error[] = [];

    const results = await Promise.allSettled(
      uniqueAnnotations.map(async (item) => {
        try {
          await AnnotationEntity.create(item).go();
          createdAnnotations.push({
            ...item,
            source: item.source,
            status: item.status,
            label: item.label,
            assertion: item.assertion,
            id: item.annotationId,
          });
        } catch (error: any) {
          const errorMsg = error?.message || String(error);
          if (
            errorMsg.includes('already exists') ||
            errorMsg.includes('ConditionalCheckFailedException')
          ) {
            // Already exists in DB (e.g. human annotation created), safely skip overwriting
            return;
          }
          throw error;
        }
      }),
    );

    // Collect unexpected failures (non-duplicate errors)
    for (const result of results) {
      if (result.status === 'rejected') {
        unexpectedErrors.push(result.reason);
      }
    }

    if (createdAnnotations.length > 0) {
      await this.audit.createAuditLog(
        documentId,
        'LLM_EXTRACTION_SUCCESS',
        `AI pipeline successfully completed clinical NER and extracted ${createdAnnotations.length} concepts.`,
      );
    }

    // Re-throw after auditing so persisted annotations are never left unaudited
    if (unexpectedErrors.length > 0) {
      throw unexpectedErrors[0];
    }

    return createdAnnotations;
  }

  async updateAnnotation(
    annotationId: string,
    updates: Partial<Annotation>,
  ): Promise<Annotation> {
    // 1. Query the GSI to find the documentId for this annotationId
    const findResponse = await AnnotationEntity.query
      .bySk({ annotationId })
      .go();

    const item = findResponse.data?.[0];
    if (!item) {
      throw new Error(`Annotation with id ${annotationId} not found`);
    }
    const documentId = item.documentId;

    // Disallow modifying tuple fields (startOffset, endOffset, label) that define deterministic identity
    if (
      (updates.startOffset !== undefined &&
        updates.startOffset !== item.startOffset) ||
      (updates.endOffset !== undefined &&
        updates.endOffset !== item.endOffset) ||
      (updates.label !== undefined && updates.label !== item.label)
    ) {
      throw new Error(
        'Cannot modify startOffset, endOffset, or label on an existing annotation. Please delete the annotation and create a new one.',
      );
    }

    // Remove keys that cannot be modified (like keys used in PK/SK)
    const cleanedUpdates: Record<string, string | number | undefined> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (
        key !== 'annotationId' &&
        key !== 'documentId' &&
        key !== 'id' &&
        value !== undefined
      ) {
        cleanedUpdates[key] = value;
      }
    }

    if (Object.keys(cleanedUpdates).length === 0) {
      return {
        ...item,
        id: item.annotationId,
      };
    }

    try {
      const response = await AnnotationEntity.patch({
        documentId,
        annotationId,
      })
        .set(cleanedUpdates)
        .go({ response: 'all_new' });

      if (!response.data) {
        throw new Error(`Annotation with id ${annotationId} not found`);
      }

      let actionType = 'ANNOTATION_UPDATED';
      let desc = `Clinician updated annotation "${response.data.text}"`;
      if (updates.status === 'accepted') {
        actionType = 'ANNOTATION_ACCEPTED';
        desc = `Clinician accepted suggested ${response.data.label}: "${response.data.text}"`;
      } else if (updates.status === 'rejected') {
        actionType = 'ANNOTATION_REJECTED';
        desc = `Clinician rejected suggested ${response.data.label}: "${response.data.text}"`;
        await this.relationships.deleteRelationshipsByAnnotation(documentId, annotationId);
      } else if (updates.status === 'corrected') {
        actionType = 'ANNOTATION_CORRECTED';
        desc = `Clinician corrected suggested ${response.data.label}: "${response.data.text}"`;
      }

      await this.audit.createAuditLog(documentId, actionType, desc);

      return {
        ...response.data,
        id: response.data.annotationId,
      };
    } catch (error) {
      console.error('Error updating annotation', error);
      throw new Error(`Annotation with id ${annotationId} not found`);
    }
  }

  async searchAnnotations(filters: {
    assertion?: 'positive' | 'negated' | 'possible';
    label?: MedicalEntityLabel;
    conceptCode?: string;
  }): Promise<Annotation[]> {
    const mapItems = (items: Array<Record<string, unknown>>): Annotation[] =>
      items.map(
        (item) =>
          ({
            ...item,
            id: (item.annotationId || item.id) as string,
          }) as Annotation,
      );

    try {
      if (filters.assertion && filters.label) {
        const query = AnnotationEntity.query.byAssertionLabel({
          assertion: filters.assertion,
          label: filters.label,
        });
        if (filters.conceptCode) {
          query.where(({ conceptCode }, { eq }) =>
            eq(conceptCode, filters.conceptCode!),
          );
        }
        const res = await query.go();
        return mapItems(res.data || []);
      }

      // If only assertion is provided, query across all labels in parallel
      if (filters.assertion) {
        const labels = Object.values(MEDICAL_ENTITIES);
        const results = await Promise.all(
          labels.map(async (label) => {
            const q = AnnotationEntity.query.byAssertionLabel({
              assertion: filters.assertion!,
              label,
            });
            if (filters.conceptCode) {
              q.where(({ conceptCode }, { eq }) =>
                eq(conceptCode, filters.conceptCode!),
              );
            }
            const res = await q.go();
            return res.data || [];
          }),
        );
        return mapItems(results.flat());
      }

      // If assertion is not provided but label is, query across all assertion partitions in parallel
      if (filters.label) {
        const assertions: Array<'positive' | 'negated' | 'possible'> = [
          'positive',
          'negated',
          'possible',
        ];
        const results = await Promise.all(
          assertions.map(async (assertion) => {
            const q = AnnotationEntity.query.byAssertionLabel({
              assertion,
              label: filters.label,
            });
            if (filters.conceptCode) {
              q.where(({ conceptCode }, { eq }) =>
                eq(conceptCode, filters.conceptCode!),
              );
            }
            const res = await q.go();
            return res.data || [];
          }),
        );
        return mapItems(results.flat());
      }

      // If only conceptCode is provided, query across all assertion partitions in parallel
      if (filters.conceptCode) {
        const assertions: Array<'positive' | 'negated' | 'possible'> = [
          'positive',
          'negated',
          'possible',
        ];
        const results = await Promise.all(
          assertions.map(async (assertion) => {
            const q = AnnotationEntity.query.byAssertionLabel({ assertion });
            q.where(({ conceptCode }, { eq }) =>
              eq(conceptCode, filters.conceptCode!),
            );
            const res = await q.go();
            return res.data || [];
          }),
        );
        return mapItems(results.flat());
      }

      return [];
    } catch (error) {
      console.error('Error searching annotations', error);
      return [];
    }
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    const findResponse = await AnnotationEntity.query
      .bySk({ annotationId })
      .go();

    const item = findResponse.data?.[0];
    if (!item) {
      throw new Error(`Annotation with id ${annotationId} not found`);
    }
    const documentId = item.documentId;

    // Delete cascading relationships first via RelationshipsService
    await this.relationships.deleteRelationshipsByAnnotation(documentId, annotationId);

    // Delete the annotation
    await AnnotationEntity.delete({ documentId, annotationId }).go();

    // Log audit trail via AuditService
    await this.audit.createAuditLog(
      documentId,
      'ANNOTATION_DELETED',
      `Clinician deleted annotation: "${item.text}"`,
    );
  }

  // Backward-compatible delegates
  async getAuditLogs(documentId: string): Promise<AuditLog[]> {
    return this.audit.getAuditLogs(documentId);
  }

  async createAuditLog(
    documentId: string,
    actionType: string,
    description: string,
  ): Promise<AuditLog | undefined> {
    return this.audit.createAuditLog(documentId, actionType, description);
  }

  async getRelationshipsByDocument(documentId: string): Promise<Relationship[]> {
    return this.relationships.getRelationshipsByDocument(documentId);
  }

  async createRelationship(
    data: Omit<Relationship, 'relationshipId' | 'createdAt' | 'id'>,
  ): Promise<Relationship> {
    return this.relationships.createRelationship(data);
  }

  async createRelationships(
    documentId: string,
    relationshipsData: Omit<
      Relationship,
      'relationshipId' | 'createdAt' | 'documentId' | 'id'
    >[],
  ): Promise<Relationship[]> {
    return this.relationships.createRelationships(documentId, relationshipsData);
  }

  async deleteRelationship(
    documentId: string,
    relationshipId: string,
  ): Promise<void> {
    return this.relationships.deleteRelationship(documentId, relationshipId);
  }

  async deleteRelationshipsByAnnotation(
    documentId: string,
    annotationId: string,
  ): Promise<number> {
    return this.relationships.deleteRelationshipsByAnnotation(documentId, annotationId);
  }
}

export const annotationsService = new AnnotationsService();
