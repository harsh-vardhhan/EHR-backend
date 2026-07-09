import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export const client = new DynamoDBClient({});
export const table = process.env.EHR_TABLE_NAME || 'EhrTable';
