import { DynamoDBStreamEvent } from 'aws-lambda';
import { FirehoseClient, PutRecordBatchCommand, type _Record as FirehoseRecord } from '@aws-sdk/client-firehose';
import { config } from 'shared';

const firehoseClient = new FirehoseClient({});
const MAX_FIREHOSE_BATCH_SIZE = 500;

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log('Audit Consumer received event with', event.Records.length, 'records');

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

  // Chunk records into batches of up to 500 (Kinesis Firehose batch limit)
  for (let i = 0; i < firehoseRecords.length; i += MAX_FIREHOSE_BATCH_SIZE) {
    const chunk = firehoseRecords.slice(i, i + MAX_FIREHOSE_BATCH_SIZE);
    try {
      const command = new PutRecordBatchCommand({
        DeliveryStreamName: deliveryStreamName,
        Records: chunk,
      });

      const response = await firehoseClient.send(command);
      if (response.FailedPutCount && response.FailedPutCount > 0) {
        console.warn(
          `Firehose batch put had ${response.FailedPutCount} failed records out of ${chunk.length}`,
        );
      } else {
        console.log(
          `Successfully streamed batch of ${chunk.length} audit logs to Firehose.`,
        );
      }
    } catch (error) {
      console.error('Failed to stream batch of audit logs to Firehose', error);
      throw error;
    }
  }
};
