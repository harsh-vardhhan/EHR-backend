import { randomUUID } from 'crypto';
import { MEDICAL_ENTITIES } from '../constants/labels';
import type { MedicalEntityLabel } from '../constants/labels';
import {
  AnnotationEntity,
  DocumentEntity,
  AuditLogEntity,
  RelationshipEntity,
} from '../database/entities';

export interface Annotation {
  id?: string;
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
  relationshipId: string;
  documentId: string;
  sourceAnnotationId: string;
  targetAnnotationId: string;
  relationType: string;
  confidence?: number;
  createdAt: string;
}

export class AnnotationsService {
  async getAnnotationsByDocument(documentId: string): Promise<Annotation[]> {
    try {
      const response = await AnnotationEntity.query
        .primary({ documentId })
        .go();
      return (
        ((response.data || []) as any[]).map((item) => ({
          ...item,
          id: item.annotationId,
        })) || []
      );
    } catch (error) {
      console.error('Error fetching annotations', error);
      return [];
    }
  }

  async createAnnotation(
    data: Omit<Annotation, 'annotationId' | 'createdAt'>,
  ): Promise<Annotation> {
    // Check if document exists in the single table
    const docRes = await DocumentEntity.get({ id: data.documentId }).go();
    if (!docRes.data) {
      throw new Error(`Document with id ${data.documentId} not found`);
    }

    const annotationId = randomUUID();
    const newAnnotation = {
      ...data,
      annotationId,
      createdAt: new Date().toISOString(),
    };

    await AnnotationEntity.create(newAnnotation as any).go();
    await this.createAuditLog(
      data.documentId,
      'ANNOTATION_CREATED',
      `Clinician manually created ${data.label} annotation: "${data.text}"`,
    );
    return {
      ...newAnnotation,
      id: annotationId,
    };
  }

  async createAnnotations(
    documentId: string,
    annotationsData: Omit<
      Annotation,
      'annotationId' | 'createdAt' | 'documentId'
    >[],
  ): Promise<Annotation[]> {
    if (annotationsData.length === 0) return [];

    const docRes = await DocumentEntity.get({ id: documentId }).go();
    if (!docRes.data) {
      throw new Error(`Document with id ${documentId} not found`);
    }

    const timestamp = new Date().toISOString();
    const newAnnotations = annotationsData.map((data) => ({
      ...data,
      documentId,
      annotationId: randomUUID(),
      createdAt: timestamp,
    }));

    await AnnotationEntity.put(newAnnotations as any).go();
    await this.createAuditLog(
      documentId,
      'LLM_EXTRACTION_SUCCESS',
      `AI pipeline successfully completed clinical NER and extracted ${newAnnotations.length} concepts.`,
    );
    return newAnnotations.map((item) => ({
      ...item,
      id: item.annotationId,
    }));
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

    // Remove keys that cannot be modified (like keys used in PK/SK)
    const cleanedUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (
        key !== 'annotationId' &&
        key !== 'documentId' &&
        value !== undefined
      ) {
        cleanedUpdates[key] = value;
      }
    }

    if (Object.keys(cleanedUpdates).length === 0) {
      return {
        ...item,
        id: item.annotationId,
      } as unknown as Annotation;
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
        id: response.data.annotationId,
      } as unknown as Annotation;
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
    const mapItems = (items: any[]) =>
      items.map((item) => ({
        ...item,
        id: item.annotationId,
      })) as unknown as Annotation[];

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
      return response.data || [];
    } catch (error) {
      console.error('Error fetching relationships', error);
      return [];
    }
  }

  async createRelationship(
    data: Omit<Relationship, 'relationshipId' | 'createdAt'>,
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
    const newRelationship: Relationship = {
      ...data,
      relationshipId,
      createdAt: new Date().toISOString(),
    };

    await RelationshipEntity.create(newRelationship).go();
    await this.createAuditLog(
      data.documentId,
      'RELATIONSHIP_CREATED',
      `Clinician manually linked annotation ${data.sourceAnnotationId} to ${data.targetAnnotationId} as ${data.relationType}`,
    );
    return newRelationship;
  }

  async createRelationships(
    documentId: string,
    relationshipsData: Omit<
      Relationship,
      'relationshipId' | 'createdAt' | 'documentId'
    >[],
  ): Promise<Relationship[]> {
    if (relationshipsData.length === 0) return [];

    const docRes = await DocumentEntity.get({ id: documentId }).go();
    if (!docRes.data) {
      throw new Error(`Document with id ${documentId} not found`);
    }

    const timestamp = new Date().toISOString();
    const newRelationships: Relationship[] = relationshipsData.map((data) => ({
      ...data,
      documentId,
      relationshipId: randomUUID(),
      createdAt: timestamp,
    }));

    await RelationshipEntity.put(newRelationships).go();
    await this.createAuditLog(
      documentId,
      'LLM_RELATIONS_EXTRACTED',
      `AI pipeline successfully extracted and saved ${newRelationships.length} relationships.`,
    );
    return newRelationships;
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
