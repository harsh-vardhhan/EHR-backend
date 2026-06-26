import 'dotenv/config';
import { handler } from '../worker';
import { SQSEvent } from 'aws-lambda';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME || 'ehr-demo-docs-bucket';

async function runLocalWorkerTest() {
  console.log('🏁 Starting Local SQS Worker simulation...');
  console.log(`🪣 Target Bucket: ${BUCKET_NAME}`);

  const notesPath = path.join(__dirname, 'notes.json');
  const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));

  // Construct mock SQS event containing all 10 documents
  const records = notes.map((note: any, index: number) => {
    const s3Key = `documents/${note.id}.txt`;
    const body = {
      source: 'aws.s3',
      detail: {
        bucket: {
          name: BUCKET_NAME,
        },
        object: {
          key: s3Key,
        },
      },
    };

    return {
      messageId: `mock-msg-${index}`,
      receiptHandle: `receipt-${index}`,
      body: JSON.stringify(body),
      attributes: {} as any,
      messageAttributes: {},
      md5OfBody: '',
      eventSource: 'aws:sqs',
      eventSourceARN: '',
      awsRegion: 'ap-south-1',
    };
  });

  // We process in batches of 5, matching the SQS batch size of the worker function
  const batchSize = 5;
  for (let i = 0; i < records.length; i += batchSize) {
    const batchRecords = records.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} with ${batchRecords.length} records...`);

    const mockEvent: SQSEvent = {
      Records: batchRecords,
    };

    try {
      const response = await handler(mockEvent);
      console.log(`✅ Batch complete. Failures reported:`, response.batchItemFailures);
    } catch (error) {
      console.error(`❌ Batch failed with error:`, error);
    }
  }

  console.log('\n🎉 Local Worker Simulation complete!');
}

runLocalWorkerTest().catch((err) => {
  console.error('Fatal test error:', err);
});
