import { DynamoDBStreamEvent } from 'aws-lambda';
import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose';

const firehoseClient = new FirehoseClient({});
const DELIVERY_STREAM_NAME = process.env.AUDIT_DELIVERY_STREAM_NAME;

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log('Audit Consumer received event:', JSON.stringify(event, null, 2));

  if (!DELIVERY_STREAM_NAME) {
    console.error(
      'AUDIT_DELIVERY_STREAM_NAME environment variable is not set. Cannot stream logs.',
    );
    return;
  }

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

    try {
      // Unmarshall DynamoDB image to a plain javascript object
      const auditRecord = {
        logId: newImage.logId?.S,
        documentId: newImage.documentId?.S,
        actionType: newImage.actionType?.S,
        description: newImage.description?.S,
        createdAt: newImage.createdAt?.S,
      };

      console.log(
        `Forwarding audit log ${auditRecord.logId} to Kinesis Firehose...`,
      );

      // Append newline to support JSON Lines (NDJSON) format in S3
      const recordData = JSON.stringify(auditRecord) + '\n';

      const command = new PutRecordCommand({
        DeliveryStreamName: DELIVERY_STREAM_NAME,
        Record: {
          Data: new TextEncoder().encode(recordData),
        },
      });

      await firehoseClient.send(command);
      console.log(
        `Successfully streamed log ${auditRecord.logId} to Firehose.`,
      );
    } catch (error) {
      console.error(
        `Failed to process stream record: ${JSON.stringify(record)}`,
        error,
      );
    }
  }
};
