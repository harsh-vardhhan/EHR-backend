import { DynamoDBStreamEvent } from 'aws-lambda';
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

/**
 * Splits records into batches respecting both Firehose limits:
 * 1. Maximum 500 records per batch
 * 2. Maximum ~3.8 MiB total payload per batch
 */
function createBatches(records: FirehoseRecord[]): FirehoseRecord[][] {
  const batches: FirehoseRecord[][] = [];
  let currentBatch: FirehoseRecord[] = [];
  let currentBatchBytes = 0;

  for (const record of records) {
    const recordBytes = record.Data?.byteLength || 0;

    const wouldExceedCount = currentBatch.length >= MAX_FIREHOSE_BATCH_COUNT;
    const wouldExceedBytes =
      currentBatch.length > 0 &&
      currentBatchBytes + recordBytes > MAX_FIREHOSE_BATCH_BYTES;

    if (wouldExceedCount || wouldExceedBytes) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchBytes = 0;
    }

    currentBatch.push(record);
    currentBatchBytes += recordBytes;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Sends a single batch of records to Firehose with retries for partial failures.
 * Throws if any records fail after all retries to trigger Lambda stream retry.
 */
async function sendBatchWithRetry(
  deliveryStreamName: string,
  records: FirehoseRecord[],
): Promise<void> {
  let pendingRecords = records;
  let attempt = 0;

  while (pendingRecords.length > 0 && attempt < MAX_RETRIES) {
    attempt++;
    const command = new PutRecordBatchCommand({
      DeliveryStreamName: deliveryStreamName,
      Records: pendingRecords,
    });

    const response = await firehoseClient.send(command);

    if (response.FailedPutCount && response.FailedPutCount > 0) {
      console.warn(
        `Firehose batch put attempt ${attempt} had ${response.FailedPutCount} failed records out of ${pendingRecords.length}`,
      );

      // Collect only the failed records to retry
      const failedRecords: FirehoseRecord[] = [];
      response.RequestResponses?.forEach((item, index) => {
        if (item.ErrorCode) {
          failedRecords.push(pendingRecords[index]);
        }
      });

      pendingRecords = failedRecords;

      if (pendingRecords.length > 0 && attempt < MAX_RETRIES) {
        // Exponential backoff before retry (50ms, 100ms, 200ms)
        const delayMs = Math.pow(2, attempt - 1) * 50;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } else {
      pendingRecords = [];
    }
  }

  if (pendingRecords.length > 0) {
    throw new Error(
      `Failed to deliver ${pendingRecords.length} audit records to Firehose after ${MAX_RETRIES} attempts. Triggering stream retry.`,
    );
  }
}

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log(
    'Audit Consumer received event with',
    event.Records.length,
    'records',
  );

  const deliveryStreamName = config.auditDeliveryStreamName;
  if (!deliveryStreamName) {
    console.error(
      'AUDIT_DELIVERY_STREAM_NAME environment variable is not set. Cannot stream logs.',
    );
    return;
  }

  const firehoseRecords: FirehoseRecord[] = [];

  for (const record of event.Records) {
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
    firehoseRecords.push({
      Data: new TextEncoder().encode(recordData),
    });
  }

  if (firehoseRecords.length === 0) {
    return;
  }

  // Create batches bounded by both record count (< 500) and byte size (< 3.8 MiB)
  const batches = createBatches(firehoseRecords);

  for (const batch of batches) {
    await sendBatchWithRetry(deliveryStreamName, batch);
  }

  console.log(
    `Successfully streamed ${firehoseRecords.length} audit log(s) across ${batches.length} batch(es) to Firehose.`,
  );
};
