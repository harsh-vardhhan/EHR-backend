import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const EHR_TABLE_NAME = process.env.EHR_TABLE_NAME;

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

async function cleanupTable(tableName: string) {
  if (!tableName) {
    console.warn(`Table name not configured. Skipping.`);
    return;
  }
  console.log(`Scanning table ${tableName}...`);
  try {
    const scanResponse = await docClient.send(
      new ScanCommand({ TableName: tableName }),
    );
    const items = scanResponse.Items || [];
    console.log(`Found ${items.length} items to delete in ${tableName}.`);

    for (const item of items) {
      console.log(`Deleting item with PK = ${item.PK}, SK = ${item.SK}...`);
      await docClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { PK: item.PK, SK: item.SK },
        }),
      );
    }
    console.log(`Deleted all items from ${tableName}.`);
  } catch (err: any) {
    console.error(`Error deleting from ${tableName}:`, err.message);
  }
}

async function main() {
  await cleanupTable(EHR_TABLE_NAME || '');
}

main().catch(console.error);
