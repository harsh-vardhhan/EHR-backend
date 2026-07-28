import { Entity } from 'electrodb';
import { client, table } from './client';
import { MEDICAL_ENTITIES } from '../constants/labels';

export const AnnotationEntity = new Entity(
  {
    model: {
      entity: 'annotation',
      service: 'ehr',
      version: '1',
    },
    attributes: {
      annotationId: { type: 'string', required: true },
      documentId: { type: 'string', required: true },
      text: { type: 'string', required: true },
      label: {
        type: [
          MEDICAL_ENTITIES.CONDITION,
          MEDICAL_ENTITIES.MEDICATION,
          MEDICAL_ENTITIES.FINDING,
          MEDICAL_ENTITIES.PROCEDURE,
        ] as const,
        required: true,
      },
      startOffset: { type: 'number', required: true },
      endOffset: { type: 'number', required: true },
      createdAt: { type: 'string', required: true },
      source: { type: ['human', 'llm'] as const, required: true },
      status: {
        type: ['suggested', 'accepted', 'rejected', 'corrected'] as const,
      },
      confidence: { type: 'number' },
      assertion: { type: ['positive', 'negated', 'possible'] as const },
      conceptCode: { type: 'string' },
    },
    indexes: {
      primary: {
        pk: {
          field: 'PK',
          composite: ['documentId'],
          template: 'DOCUMENT#${documentId}',
        },
        sk: {
          field: 'SK',
          composite: ['annotationId'],
          template: 'ANNOTATION#${annotationId}',
        },
      },
      bySk: {
        index: 'SKIndex',
        pk: {
          field: 'SK',
          composite: ['annotationId'],
          template: 'ANNOTATION#${annotationId}',
        },
        sk: {
          field: 'PK',
          composite: ['documentId'],
          template: 'DOCUMENT#${documentId}',
        },
      },
      byAssertionLabel: {
        index: 'GSI1Index',
        pk: {
          field: 'GSI1PK',
          composite: ['assertion'],
          template: 'ASSERTION#${assertion}',
        },
        sk: {
          field: 'GSI1SK',
          composite: ['label'],
          template: 'LABEL#${label}',
        },
      },
    },
  },
  { client, table },
);

export const AuditLogEntity = new Entity(
  {
    model: {
      entity: 'auditLog',
      service: 'ehr',
      version: '1',
    },
    attributes: {
      logId: { type: 'string', required: true },
      documentId: { type: 'string', required: true },
      actionType: { type: 'string', required: true },
      description: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
    },
    indexes: {
      primary: {
        pk: {
          field: 'PK',
          composite: ['documentId'],
          template: 'DOCUMENT#${documentId}',
        },
        sk: {
          field: 'SK',
          composite: ['logId'],
          template: 'AUDIT#${logId}',
        },
      },
    },
  },
  { client, table },
);

export const RelationshipEntity = new Entity(
  {
    model: {
      entity: 'relationship',
      service: 'ehr',
      version: '1',
    },
    attributes: {
      relationshipId: { type: 'string', required: true },
      documentId: { type: 'string', required: true },
      sourceAnnotationId: { type: 'string', required: true },
      targetAnnotationId: { type: 'string', required: true },
      relationType: { type: 'string', required: true },
      confidence: { type: 'number' },
      createdAt: { type: 'string', required: true },
    },
    indexes: {
      primary: {
        pk: {
          field: 'PK',
          composite: ['documentId'],
          template: 'DOCUMENT#${documentId}',
        },
        sk: {
          field: 'SK',
          composite: ['relationshipId'],
          template: 'RELATIONSHIP#${relationshipId}',
        },
      },
    },
  },
  { client, table },
);
