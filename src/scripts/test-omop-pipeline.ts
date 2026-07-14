import 'dotenv/config';
import { FirehoseClient } from '@aws-sdk/client-firehose';
import { handler } from '../omop-pipeline';
import { DynamoDBStreamEvent } from 'aws-lambda';

// 1. Mock the Kinesis Firehose Client to prevent actual AWS calls
const interceptedPayloads: any[] = [];
FirehoseClient.prototype.send = function (command: any) {
  const rawData = command.input.Record.Data;
  const decodedString = new TextDecoder().decode(rawData);
  interceptedPayloads.push(JSON.parse(decodedString.trim()));
  return Promise.resolve({} as any);
};

// 2. Setup mock environment variables
process.env.OMOP_DELIVERY_STREAM_NAME = 'mock-omop-stream';

// 3. Construct mock DynamoDB Stream events
const mockStreamEvent: DynamoDBStreamEvent = {
  Records: [
    {
      eventID: '1',
      eventName: 'INSERT',
      eventVersion: '1.1',
      eventSource: 'aws:dynamodb',
      awsRegion: 'ap-south-1',
      dynamodb: {
        ApproximateCreationDateTime: 1234567,
        Keys: {},
        NewImage: {
          __edb_e__: { S: 'annotation' },
          annotationId: { S: 'mock-uuid-cond-1' },
          documentId: { S: 'doc-001' },
          text: { S: 'coronary artery disease' },
          label: { S: 'Condition' },
          assertion: { S: 'positive' },
          conceptCode: { S: '699196002' },
          createdAt: { S: '2026-07-13T16:09:35.778Z' },
        },
        SequenceNumber: '1',
        SizeBytes: 100,
        StreamViewType: 'NEW_IMAGE',
      },
    },
    {
      eventID: '2',
      eventName: 'INSERT',
      eventVersion: '1.1',
      eventSource: 'aws:dynamodb',
      awsRegion: 'ap-south-1',
      dynamodb: {
        ApproximateCreationDateTime: 1234567,
        Keys: {},
        NewImage: {
          __edb_e__: { S: 'annotation' },
          annotationId: { S: 'mock-uuid-med-1' },
          documentId: { S: 'doc-001' },
          text: { S: 'Metformin 500mg' },
          label: { S: 'Medication' },
          conceptCode: { S: '12345' },
          createdAt: { S: '2026-07-13T16:09:35.778Z' },
        },
        SequenceNumber: '2',
        SizeBytes: 100,
        StreamViewType: 'NEW_IMAGE',
      },
    },
    {
      eventID: '3',
      eventName: 'INSERT',
      eventVersion: '1.1',
      eventSource: 'aws:dynamodb',
      awsRegion: 'ap-south-1',
      dynamodb: {
        ApproximateCreationDateTime: 1234567,
        Keys: {},
        NewImage: {
          __edb_e__: { S: 'annotation' },
          annotationId: { S: 'mock-uuid-proc-1' },
          documentId: { S: 'doc-001' },
          text: { S: 'heart bypass surgery' },
          label: { S: 'Procedure' },
          conceptCode: { S: '54321' },
          createdAt: { S: '2026-07-13T16:09:35.778Z' },
        },
        SequenceNumber: '3',
        SizeBytes: 100,
        StreamViewType: 'NEW_IMAGE',
      },
    },
    {
      eventID: '4',
      eventName: 'INSERT',
      eventVersion: '1.1',
      eventSource: 'aws:dynamodb',
      awsRegion: 'ap-south-1',
      dynamodb: {
        ApproximateCreationDateTime: 1234567,
        Keys: {},
        NewImage: {
          __edb_e__: { S: 'auditLog' }, // Should be skipped (not an annotation)
          logId: { S: 'mock-log-1' },
          documentId: { S: 'doc-001' },
          actionType: { S: 'INGESTION_COMPLETED' },
        },
        SequenceNumber: '4',
        SizeBytes: 100,
        StreamViewType: 'NEW_IMAGE',
      },
    },
  ],
};

async function runTest() {
  console.log('🚀 Executing local mapping verification test...');
  await handler(mockStreamEvent);

  console.log('\n🔍 Verifying mapped OMOP payloads...');
  console.log(
    `Total records pushed: ${interceptedPayloads.length} (Expected: 3, auditLog should be skipped)`,
  );

  interceptedPayloads.forEach((payload, index) => {
    console.log(`\n--- Mapped Record ${index + 1} ---`);
    console.log(`Target Table: ${payload.table}`);
    console.log('Record Data:', JSON.stringify(payload.data, null, 2));
  });

  // Verify correctness
  const cond = interceptedPayloads.find(
    (p) => p.table === 'condition_occurrence',
  );
  const med = interceptedPayloads.find((p) => p.table === 'drug_exposure');
  const proc = interceptedPayloads.find(
    (p) => p.table === 'procedure_occurrence',
  );

  const success =
    cond &&
    cond.data.condition_concept_id === '699196002' &&
    cond.data.assertion_status === 'positive' &&
    med &&
    med.data.drug_concept_id === '12345' &&
    proc &&
    proc.data.procedure_concept_id === '54321' &&
    interceptedPayloads.length === 3;

  if (success) {
    console.log(
      '\n✅ Local OMOP pipeline mapper validation PASSED successfully!',
    );
  } else {
    console.error('\n❌ Local OMOP pipeline mapper validation FAILED.');
    process.exit(1);
  }
}

runTest().catch(console.error);
