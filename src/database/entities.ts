import { Entity, Service } from 'electrodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});
const table = process.env.EHR_TABLE_NAME || 'EhrTable';

export const DocumentEntity = new Entity(
  {
    model: {
      entity: 'document',
      service: 'ehr',
      version: '1',
    },
    attributes: {
      id: { type: 'string', required: true },
      title: { type: 'string', required: true },
      category: { type: 'string', required: true },
      s3Key: { type: 'string', required: true },
      status: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
    },
    indexes: {
      primary: {
        pk: {
          field: 'PK',
          composite: ['id'],
          template: 'DOCUMENT#${id}',
        },
        sk: {
          field: 'SK',
          composite: [],
          template: 'METADATA',
        },
      },
      bySk: {
        index: 'SKIndex',
        pk: {
          field: 'SK',
          composite: [],
          template: 'METADATA',
        },
        sk: {
          field: 'PK',
          composite: ['id'],
          template: 'DOCUMENT#${id}',
        },
      },
    },
  },
  { client, table },
);

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
      label: { type: 'string', required: true }, // MedicalEntityLabel
      startOffset: { type: 'number', required: true },
      endOffset: { type: 'number', required: true },
      createdAt: { type: 'string', required: true },
      source: { type: 'string', required: true }, // 'human' | 'llm'
      status: { type: 'string' },
      confidence: { type: 'number' },
      assertion: { type: 'string' }, // 'positive' | 'negated' | 'possible'
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

export const EhrService = new Service({
  document: DocumentEntity,
  annotation: AnnotationEntity,
  auditLog: AuditLogEntity,
});
