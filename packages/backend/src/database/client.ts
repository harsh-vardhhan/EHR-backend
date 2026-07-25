import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
  override: true,
});
dotenv.config({ override: true });

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export const client = new DynamoDBClient({});
export const table = process.env.EHR_TABLE_NAME || 'ehr-table';
