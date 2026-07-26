import { randomUUID, createHash } from 'crypto';
import {
  MEDICAL_ENTITIES,
  AnnotationEntity,
  DocumentEntity,
  AuditLogEntity,
  RelationshipEntity,
} from 'shared';
import type { MedicalEntityLabel } from 'shared';

export interface Annotation {
  id: string;
  annotationId: string;
  documentId: string;
  text: string;
  label: MedicalEntityLabel;
  startOffset: number;
  endOffset: number;
  createdAt: string;
  source: 'human' | 'llm';
  status?: 'suggested' | 'accepted' | 'rejected' | 'corrected';
  confidence?: number;
  assertion?: 'positive' | 'negated' | 'possible';
  conceptCode?: string;
}

export interface Relationship {
  id: string;
  relationshipId: string;
  documentId: string;
  sourceAnnotationId: string;
  targetAnnotationId: string;
  relationType: string;
  confidence?: number;
  createdAt: string;
}

export class AnnotationsService {
  /**
   * Generates a 100% deterministic UUID v5-compatible string derived from the entity span.
   * Ensures native DynamoDB uniqueness on (documentId, startOffset, endOffset, label)
   * with zero race conditions and zero extra read query overhead.
   */
  private generateDeterministicUuid(
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
      source: item.source as Annotation['source'],
      status: item.status as Annotation['status'],
      label: item.label as MedicalEntityLabel,
      assertion: item.assertion as Annotation['assertion'],
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

    await this.createAuditLog(
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
      await this.createAuditLog(
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
        source: item.source as Annotation['source'],
        status: item.status as Annotation['status'],
        label: item.label as MedicalEntityLabel,
        assertion: item.assertion as Annotation['assertion'],
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
        await this.deleteRelationshipsByAnnotation(documentId, annotationId);
      } else if (updates.status === 'corrected') {
        actionType = 'ANNOTATION_CORRECTED';
        desc = `Clinician corrected suggested ${response.data.label}: "${response.data.text}"`;
      }

      await this.createAuditLog(documentId, actionType, desc);

      return {
        ...response.data,
        source: response.data.source as Annotation['source'],
        status: response.data.status as Annotation['status'],
        label: response.data.label as MedicalEntityLabel,
        assertion: response.data.assertion as Annotation['assertion'],
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
            source: item.source as Annotation['source'],
            status: item.status as Annotation['status'],
            label: item.label as MedicalEntityLabel,
            assertion: item.assertion as Annotation['assertion'],
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

  async getAuditLogs(documentId: string) {
    try {
      const response = await AuditLogEntity.query.primary({ documentId }).go();
      return (response.data || []).sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    } catch (error) {
      console.error('Error fetching audit logs', error);
      return [];
    }
  }

  async createAuditLog(
    documentId: string,
    actionType: string,
    description: string,
  ) {
    try {
      const logId = randomUUID();
      const log = {
        logId,
        documentId,
        actionType,
        description,
        createdAt: new Date().toISOString(),
      };
      await AuditLogEntity.create(log).go();
      return log;
    } catch (error) {
      console.error('Error creating audit log in DynamoDB', error);
    }
  }

  async getRelationshipsByDocument(
    documentId: string,
  ): Promise<Relationship[]> {
    try {
      const response = await RelationshipEntity.query
        .primary({ documentId })
        .go();
      return (response.data || []).map((item) => ({
        ...item,
        id: item.relationshipId,
        relationshipId: item.relationshipId,
      }));
    } catch (error) {
      console.error('Error fetching relationships', error);
      return [];
    }
  }

  async createRelationship(
    data: Omit<Relationship, 'relationshipId' | 'createdAt' | 'id'>,
  ): Promise<Relationship> {
    const docRes = await DocumentEntity.get({ id: data.documentId }).go();
    if (!docRes.data) {
      throw new Error(`Document with id ${data.documentId} not found`);
    }

    // Verify source annotation exists and belongs to the document
    const sourceAnn = await AnnotationEntity.get({
      documentId: data.documentId,
      annotationId: data.sourceAnnotationId,
    }).go();
    if (!sourceAnn.data) {
      throw new Error(
        `Source annotation with ID ${data.sourceAnnotationId} not found in document ${data.documentId}`,
      );
    }

    // Verify target annotation exists and belongs to the document
    const targetAnn = await AnnotationEntity.get({
      documentId: data.documentId,
      annotationId: data.targetAnnotationId,
    }).go();
    if (!targetAnn.data) {
      throw new Error(
        `Target annotation with ID ${data.targetAnnotationId} not found in document ${data.documentId}`,
      );
    }

    const relationshipId = randomUUID();
    const entityPayload = {
      ...data,
      relationshipId,
      createdAt: new Date().toISOString(),
    };

    await RelationshipEntity.create(entityPayload).go();
    await this.createAuditLog(
      data.documentId,
      'RELATIONSHIP_CREATED',
      `Clinician manually linked annotation ${data.sourceAnnotationId} to ${data.targetAnnotationId} as ${data.relationType}`,
    );
    return {
      ...entityPayload,
      id: relationshipId,
    };
  }

  async createRelationships(
    documentId: string,
    relationshipsData: Omit<
      Relationship,
      'relationshipId' | 'createdAt' | 'documentId' | 'id'
    >[],
  ): Promise<Relationship[]> {
    if (relationshipsData.length === 0) return [];

    const docRes = await DocumentEntity.get({ id: documentId }).go();
    if (!docRes.data) {
      throw new Error(`Document with id ${documentId} not found`);
    }

    const timestamp = new Date().toISOString();
    const newRelationships = relationshipsData.map((data) => {
      const relationshipId = randomUUID();
      return {
        ...data,
        documentId,
        relationshipId,
        createdAt: timestamp,
      };
    });

    await RelationshipEntity.put(newRelationships).go();
    await this.createAuditLog(
      documentId,
      'LLM_RELATIONS_EXTRACTED',
      `AI pipeline successfully extracted and saved ${newRelationships.length} relationships.`,
    );
    return newRelationships.map((item) => ({
      ...item,
      id: item.relationshipId,
    }));
  }

  async deleteRelationship(
    documentId: string,
    relationshipId: string,
  ): Promise<void> {
    const existing = await RelationshipEntity.get({
      documentId,
      relationshipId,
    }).go();
    if (!existing.data) {
      throw new Error(
        `Relationship with ID ${relationshipId} not found in document ${documentId}`,
      );
    }
    await RelationshipEntity.delete({ documentId, relationshipId }).go();
    await this.createAuditLog(
      documentId,
      'RELATIONSHIP_DELETED',
      `Relationship ${relationshipId} was deleted.`,
    );
  }

  async deleteRelationshipsByAnnotation(
    documentId: string,
    annotationId: string,
  ): Promise<number> {
    try {
      const relationships = await this.getRelationshipsByDocument(documentId);
      const toDelete = relationships.filter(
        (rel) =>
          rel.sourceAnnotationId === annotationId ||
          rel.targetAnnotationId === annotationId,
      );

      if (toDelete.length === 0) return 0;

      for (const rel of toDelete) {
        await RelationshipEntity.delete({
          documentId,
          relationshipId: rel.relationshipId,
        }).go();
      }

      await this.createAuditLog(
        documentId,
        'CASCADING_RELATIONSHIPS_DELETED',
        `Cleaned up ${toDelete.length} linked relationships due to annotation ${annotationId} deletion.`,
      );
      return toDelete.length;
    } catch (error) {
      console.error(
        'Failed to run cascading deletion for relationships',
        error,
      );
      return 0;
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

    // Delete cascading relationships first
    await this.deleteRelationshipsByAnnotation(documentId, annotationId);

    // Delete the annotation
    await AnnotationEntity.delete({ documentId, annotationId }).go();

    // Log audit trail
    await this.createAuditLog(
      documentId,
      'ANNOTATION_DELETED',
      `Clinician deleted annotation: "${item.text}"`,
    );
  }
}

export const annotationsService = new AnnotationsService();
