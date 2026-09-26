import { randomUUID } from 'crypto';
import { RelationshipEntity, AnnotationEntity, DocumentEntity } from '../database/entities';
import type { Relationship } from '../database/schemas';
import { auditService, type AuditService } from './audit.service';

export class RelationshipsService {
  private audit: AuditService;

  constructor(audit: AuditService = auditService) {
    this.audit = audit;
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
    await this.audit.createAuditLog(
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
    await this.audit.createAuditLog(
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
    await this.audit.createAuditLog(
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

      await this.audit.createAuditLog(
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
}

export const relationshipsService = new RelationshipsService();
