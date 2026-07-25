import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { config } from '../config';

export const client = new DynamoDBClient({});
export const table = config.tableName;
