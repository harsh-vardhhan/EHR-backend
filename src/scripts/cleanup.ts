import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import 'dotenv/config';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

async function clearTable(tableName: string, keyName: string) {
    console.log(`Clearing table: ${tableName}`);
    const scanResult = await docClient.send(new ScanCommand({ TableName: tableName }));
    const items = scanResult.Items || [];
    
    for (const item of items) {
        await docClient.send(new DeleteCommand({
            TableName: tableName,
            Key: { [keyName]: item[keyName] }
        }));
    }
    console.log(`Deleted ${items.length} items from ${tableName}`);
}

async function run() {
    await clearTable(process.env.DOCUMENTS_TABLE_NAME!, 'id');
    await clearTable(process.env.ANNOTATIONS_TABLE_NAME!, 'annotationId');
}

run().catch(console.error);
