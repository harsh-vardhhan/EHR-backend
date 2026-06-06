import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

const EHR_TABLE_NAME = process.env.EHR_TABLE_NAME;
const DOCUMENTS_BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME;

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

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

    if (items.length === 0) {
      console.log('No items to delete.');
      return;
    }

    // Chunk items into batches of 25 for BatchWriteCommand
    const batches: any[][] = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    console.log(`Deleting items in ${batches.length} batch(es)...`);
    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      console.log(
        `Processing batch ${index + 1}/${batches.length} (${batch.length} items)...`,
      );

      const deleteRequests = batch.map((item) => ({
        DeleteRequest: {
          Key: {
            PK: item.PK,
            SK: item.SK,
          },
        },
      }));

      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: deleteRequests,
          },
        }),
      );
    }
    console.log(`Deleted all items from ${tableName}.`);
  } catch (err: any) {
    console.error(`Error deleting from ${tableName}:`, err.message);
  }
}

async function cleanupBucket(bucketName: string, prefix: string) {
  if (!bucketName) {
    console.warn(`Bucket name not configured. Skipping.`);
    return;
  }
  console.log(
    `Listing objects in bucket ${bucketName} with prefix "${prefix}"...`,
  );
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });
    const listResponse = await s3Client.send(listCommand);
    const objects = listResponse.Contents || [];
    if (objects.length === 0) {
      console.log(
        `No objects found in bucket ${bucketName} with prefix "${prefix}".`,
      );
      return;
    }

    console.log(`Found ${objects.length} objects to delete in ${bucketName}.`);
    const deleteParams = {
      Bucket: bucketName,
      Delete: {
        Objects: objects.map((obj) => ({ Key: obj.Key! })),
      },
    };
    await s3Client.send(new DeleteObjectsCommand(deleteParams));
    console.log(
      `Deleted all objects in bucket ${bucketName} with prefix "${prefix}".`,
    );
  } catch (err: any) {
    console.error(`Error cleaning up bucket ${bucketName}:`, err.message);
  }
}

async function main() {
  await cleanupTable(EHR_TABLE_NAME || '');
  await cleanupBucket(DOCUMENTS_BUCKET_NAME || '', 'documents/');
}

main().catch(console.error);
