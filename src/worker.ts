import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SQSEvent } from 'aws-lambda';
import { MastraService } from './annotations/mastra.service';
import { DocumentsService } from './documents/documents.service';

let cachedApp: any;

/**
 * Enterprise Worker Handler for Clinical Data Extraction.
 * This function is triggered by SQS messages emitted by S3.
 */
export const handler = async (event: SQSEvent) => {
  console.log('Worker received event:', JSON.stringify(event, null, 2));

  const app = cachedApp ?? (await NestFactory.create(AppModule));
  if (!cachedApp) {
    cachedApp = app;
    await app.init();
  }

  const mastraService = app.get(MastraService);
  const documentsService = app.get(DocumentsService);

  for (const record of event.Records) {
    try {
      // S3 Event notification is wrapped inside the SQS body
      const s3Event = JSON.parse(record.body);
      if (!s3Event.Records) {
        console.warn('SQS message body is not a valid S3 event. Skipping.');
        continue;
      }

      for (const s3Record of s3Event.Records) {
        const key = decodeURIComponent(
          s3Record.s3.object.key.replace(/\+/g, ' '),
        );

        // Format: documents/doc-id.txt
        const docId = key.split('/').pop()?.replace('.txt', '');
        if (!docId) {
          console.warn(`Could not extract docId from key: ${key}`);
          continue;
        }

        console.log(`Starting background processing for Document: ${docId}`);

        // 1. Fetch document metadata and text
        const doc = await documentsService.getDocument(docId);
        if (!doc || !doc.text) {
          console.error(
            `Document ${docId} not found or has no text. Skipping.`,
          );
          continue;
        }

        // 2. Perform LLM Analysis
        await mastraService.runAnalysis(docId, doc.text);

        console.log(`Successfully processed Document: ${docId}`);
      }
    } catch (err) {
      console.error('Failed to process SQS record', err);
      // Re-throw to allow SQS Redrive Policy / DLQ to handle it
      throw err;
    }
  }
};
