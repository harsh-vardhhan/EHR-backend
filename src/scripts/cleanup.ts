import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const DOC_TABLE_NAME = process.env.DOCUMENTS_TABLE_NAME;
const ANN_TABLE_NAME = process.env.ANNOTATIONS_TABLE_NAME;

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

async function deleteTableItems(tableName: string, keyName: string) {
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
      console.log(`Deleting item with ${keyName} = ${item[keyName]}...`);
      await docClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { [keyName]: item[keyName] },
        }),
      );
    }
    console.log(`Deleted all items from ${tableName}.`);
  } catch (err: any) {
    console.error(`Error deleting from ${tableName}:`, err.message);
  }
}

async function main() {
  await deleteTableItems(DOC_TABLE_NAME || '', 'id');
  await deleteTableItems(ANN_TABLE_NAME || '', 'annotationId');
}

main().catch(console.error);
