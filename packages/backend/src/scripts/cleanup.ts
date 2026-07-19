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

function logJson(
  level: 'info' | 'success' | 'warn' | 'error',
  event: string,
  data: Record<string, any> = {},
) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...data,
    }),
  );
}

async function cleanupTable(tableName: string): Promise<number> {
  if (!tableName) {
    logJson('warn', 'ddb_cleanup_skipped', {
      reason: 'table_name_not_configured',
    });
    return 0;
  }
  logJson('info', 'ddb_scan_start', { table: tableName });
  try {
    const scanResponse = await docClient.send(
      new ScanCommand({ TableName: tableName }),
    );
    const items = scanResponse.Items || [];
    logJson('info', 'ddb_scan_results', {
      table: tableName,
      count: items.length,
    });

    if (items.length === 0) {
      return 0;
    }

    const batches: any[][] = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    logJson('info', 'ddb_delete_start', {
      table: tableName,
      total_batches: batches.length,
    });
    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      logJson('info', 'ddb_delete_batch', {
        table: tableName,
        batch_index: index + 1,
        total_batches: batches.length,
        batch_size: batch.length,
      });

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
    logJson('success', 'ddb_cleanup_success', {
      table: tableName,
      items_deleted: items.length,
    });
    return items.length;
  } catch (err: any) {
    logJson('error', 'ddb_cleanup_failed', {
      table: tableName,
      error: err.message,
    });
    throw err;
  }
}

async function cleanupBucket(
  bucketName: string,
  prefix: string,
): Promise<number> {
  if (!bucketName) {
    logJson('warn', 's3_cleanup_skipped', {
      reason: 'bucket_name_not_configured',
    });
    return 0;
  }
  logJson('info', 's3_list_start', { bucket: bucketName, prefix });
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });
    const listResponse = await s3Client.send(listCommand);
    const objects = listResponse.Contents || [];
    logJson('info', 's3_list_results', {
      bucket: bucketName,
      count: objects.length,
    });

    if (objects.length === 0) {
      return 0;
    }

    const deleteParams = {
      Bucket: bucketName,
      Delete: {
        Objects: objects.map((obj) => ({ Key: obj.Key! })),
      },
    };
    await s3Client.send(new DeleteObjectsCommand(deleteParams));
    logJson('success', 's3_cleanup_success', {
      bucket: bucketName,
      prefix,
      objects_deleted: objects.length,
    });
    return objects.length;
  } catch (err: any) {
    logJson('error', 's3_cleanup_failed', {
      bucket: bucketName,
      error: err.message,
    });
    throw err;
  }
}

async function main() {
  logJson('info', 'cleanup_start', {
    table: EHR_TABLE_NAME,
    bucket: DOCUMENTS_BUCKET_NAME,
  });
  try {
    const ddbDeleted = await cleanupTable(EHR_TABLE_NAME || '');
    const s3Deleted = await cleanupBucket(
      DOCUMENTS_BUCKET_NAME || '',
      'documents/',
    );
    logJson('success', 'cleanup_complete', {
      summary: {
        ddb_items_deleted: ddbDeleted,
        s3_objects_deleted: s3Deleted,
      },
    });
  } catch (err: any) {
    logJson('error', 'cleanup_failed', { error: err.message });
    process.exit(1);
  }
}

main().catch((err) => {
  logJson('error', 'cleanup_failed_fatal', { error: err.message });
  process.exit(1);
});
