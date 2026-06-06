import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { documentsService, mastraService } from './services';

/**
 * Enterprise Worker Handler for Clinical Data Extraction.
 * This function is triggered by SQS messages (routed via EventBridge or S3).
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.log('Worker received event:', JSON.stringify(event, null, 2));
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);

      let s3Bucket: string | undefined;
      let s3Key: string | undefined;

      // Handle EventBridge Wrapper (New Architecture)
      if (body.source === 'aws.s3' && body.detail) {
        console.log('Detected EventBridge S3 notification');
        s3Bucket = body.detail.bucket.name;
        s3Key = body.detail.object.key;
      }
      // Handle Direct S3 Notification (Legacy/Manual Trigger)
      else if (body.Records && body.Records[0]?.s3) {
        console.log('Detected Direct S3 notification');
        s3Bucket = body.Records[0].s3.bucket.name;
        s3Key = body.Records[0].s3.object.key;
      }

      if (!s3Bucket || !s3Key) {
        console.warn(
          'SQS message body does not contain valid S3 data. Skipping.',
          body,
        );
        continue;
      }

      const key = decodeURIComponent(s3Key.replace(/\+/g, ' '));

      // Format: documents/doc-id.txt
      const docId = key.split('/').pop()?.replace('.txt', '');
      if (!docId) {
        console.warn(`Could not extract docId from key: ${key}`);
        continue;
      }

      console.log(
        `Starting background processing for Document: ${docId} in bucket ${s3Bucket}`,
      );

      // 1. Fetch document metadata and text from S3 and ingest into DynamoDB if not present
      const doc = await documentsService.fetchAndIngestDocument(
        docId,
        s3Bucket,
        s3Key,
      );
      if (!doc || !doc.text) {
        console.error(
          `Document ${docId} could not be ingested or has no text. Skipping.`,
        );
        continue;
      }

      // 2. Perform LLM Analysis
      await mastraService.runAnalysis(docId, doc.text);

      console.log(`Successfully processed Document: ${docId}`);
    } catch (err) {
      console.error(`Failed to process SQS record: ${record.messageId}`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
