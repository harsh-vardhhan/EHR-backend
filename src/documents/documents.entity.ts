import { Entity } from 'electrodb';
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
