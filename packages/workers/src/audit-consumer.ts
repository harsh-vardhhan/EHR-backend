import {
  DynamoDBStreamEvent,
  DynamoDBBatchResponse,
} from 'aws-lambda';
import {
  FirehoseClient,
  PutRecordBatchCommand,
  type _Record as FirehoseRecord,
} from '@aws-sdk/client-firehose';
import { config } from 'shared';

const firehoseClient = new FirehoseClient({});
const MAX_FIREHOSE_BATCH_COUNT = 500;
// Firehose limit is 4 MiB (4,194,304 bytes). We set a safe threshold of ~3.8 MiB.
const MAX_FIREHOSE_BATCH_BYTES = 3.8 * 1024 * 1024;
const MAX_RETRIES = 3;

interface AuditStreamItem {
  sequenceNumber: string;
  firehoseRecord: FirehoseRecord;
}

/**
 * Splits records into batches respecting both Firehose limits:
 * 1. Maximum 500 records per batch
 * 2. Maximum ~3.8 MiB total payload per batch
 */
function createBatches(items: AuditStreamItem[]): AuditStreamItem[][] {
  const batches: AuditStreamItem[][] = [];
  let currentBatch: AuditStreamItem[] = [];
  let currentBatchBytes = 0;

  for (const item of items) {
    const recordBytes = item.firehoseRecord.Data?.byteLength || 0;

    const wouldExceedCount = currentBatch.length >= MAX_FIREHOSE_BATCH_COUNT;
    const wouldExceedBytes =
      currentBatch.length > 0 &&
      currentBatchBytes + recordBytes > MAX_FIREHOSE_BATCH_BYTES;

    if (wouldExceedCount || wouldExceedBytes) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchBytes = 0;
    }

    currentBatch.push(item);
    currentBatchBytes += recordBytes;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Sends a single batch of records to Firehose with retries for partial failures.
 * Returns sequence numbers of records that failed after exhausting all retries
 * so DynamoDB Streams partial batch response can retry only the failed records
 * without duplicating previously succeeded records.
 */
async function sendBatchWithRetry(
  deliveryStreamName: string,
  items: AuditStreamItem[],
): Promise<string[]> {
  let pendingItems = items;
  let attempt = 0;

  while (pendingItems.length > 0 && attempt < MAX_RETRIES) {
    attempt++;
    const command = new PutRecordBatchCommand({
      DeliveryStreamName: deliveryStreamName,
      Records: pendingItems.map((item) => item.firehoseRecord),
    });

    const response = await firehoseClient.send(command);

    if (response.FailedPutCount && response.FailedPutCount > 0) {
      console.warn(
        `Firehose batch put attempt ${attempt} had ${response.FailedPutCount} failed records out of ${pendingItems.length}`,
      );

      // Collect only the failed records to retry
      const failedItems: AuditStreamItem[] = [];
      response.RequestResponses?.forEach((res, index) => {
        if (res.ErrorCode) {
          failedItems.push(pendingItems[index]);
        }
      });

      pendingItems = failedItems;

      if (pendingItems.length > 0 && attempt < MAX_RETRIES) {
        // Exponential backoff before retry (50ms, 100ms, 200ms)
        const delayMs = Math.pow(2, attempt - 1) * 50;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } else {
      pendingItems = [];
    }
  }

  return pendingItems.map((item) => item.sequenceNumber);
}

export const handler = async (
  event: DynamoDBStreamEvent,
): Promise<DynamoDBBatchResponse> => {
  console.log(
    'Audit Consumer received event with',
    event.Records.length,
    'records',
  );

  const batchItemFailures: { itemIdentifier: string }[] = [];

  const deliveryStreamName = config.auditDeliveryStreamName;
  if (!deliveryStreamName) {
    console.error(
      'AUDIT_DELIVERY_STREAM_NAME environment variable is not set. Cannot stream logs.',
    );
    // Mark all records as failed so event source mapping retries when config is available
    return {
      batchItemFailures: event.Records.map((r) => ({
        itemIdentifier: r.dynamodb?.SequenceNumber || '',
      })).filter((f) => f.itemIdentifier !== ''),
    };
  }

  const auditItems: AuditStreamItem[] = [];

  for (const record of event.Records) {
    const sequenceNumber = record.dynamodb?.SequenceNumber;
    if (!sequenceNumber) {
      continue;
    }

    // Only capture new audit records (inserts)
    if (record.eventName !== 'INSERT') {
      continue;
    }

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) {
      continue;
    }

    // Verify this is an auditLog entity (ElectroDB fields: __edb_e__ or SK template)
    const entityType = newImage.__edb_e__?.S;
    const sk = newImage.SK?.S;

    const isAuditLog =
      entityType === 'auditLog' || (sk && sk.startsWith('AUDIT#'));
    if (!isAuditLog) {
      continue;
    }

    const auditRecord = {
      logId: newImage.logId?.S,
      documentId: newImage.documentId?.S,
      actionType: newImage.actionType?.S,
      description: newImage.description?.S,
      createdAt: newImage.createdAt?.S,
    };

    // Append newline to support JSON Lines (NDJSON) format in S3
    const recordData = JSON.stringify(auditRecord) + '\n';
    auditItems.push({
      sequenceNumber,
      firehoseRecord: {
        Data: new TextEncoder().encode(recordData),
      },
    });
  }

  if (auditItems.length === 0) {
    return { batchItemFailures: [] };
  }

  // Create batches bounded by both record count (< 500) and byte size (< 3.8 MiB)
  const batches = createBatches(auditItems);

  for (const batch of batches) {
    const failedSequenceNumbers = await sendBatchWithRetry(
      deliveryStreamName,
      batch,
    );
    for (const seqNum of failedSequenceNumbers) {
      batchItemFailures.push({ itemIdentifier: seqNum });
    }
  }

  if (batchItemFailures.length > 0) {
    console.warn(
      `Returning ${batchItemFailures.length} batch item failure(s) to DynamoDB Streams for targeted retry.`,
    );
  } else {
    console.log(
      `Successfully streamed ${auditItems.length} audit log(s) across ${batches.length} batch(es) to Firehose.`,
    );
  }

  return { batchItemFailures };
};
