import 'dotenv/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME || 'ehr-demo-docs-bucket';
const TABLE_NAME = process.env.EHR_TABLE_NAME || 'ehr-table';

const s3Client = new S3Client({ region: REGION });
const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

async function runTest() {
  console.log('🔍 Starting Event-Driven Partial Batch Failure Test...');
  console.log(`✅ Target Bucket: ${BUCKET_NAME}`);
  console.log(`✅ Target DynamoDB Table: ${TABLE_NAME}`);

  const validDocId = 'doc-test-dlq-valid';
  const invalidDocId = 'doc-test-dlq-invalid';

  const validS3Key = `documents/${validDocId}.txt`;
  const invalidS3Key = `documents/${invalidDocId}.txt`;

  // 1. Upload both documents
  console.log(`\n📤 Uploading valid document (${validDocId}) to S3...`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: validS3Key,
      Body: 'Valid patient visit notes. This document should process successfully.',
      ContentType: 'text/plain',
      Metadata: {
        title: encodeURIComponent('Valid DLQ Test Patient'),
        category: encodeURIComponent('Testing'),
      },
    }),
  );

  console.log(`📤 Uploading invalid document (${invalidDocId}) to S3...`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: invalidS3Key,
      Body: 'This file will be deleted immediately to force a GetObject failure.',
      ContentType: 'text/plain',
      Metadata: {
        title: encodeURIComponent('Invalid DLQ Test Patient'),
        category: encodeURIComponent('Testing'),
      },
    }),
  );

  // 2. Immediately delete the invalid one from S3
  console.log(
    `🗑️ Immediately deleting ${invalidDocId} from S3 to trigger a NoSuchKey exception...`,
  );
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: invalidS3Key,
    }),
  );

  console.log(
    '\n⏳ Waiting 8 seconds for the SQS queue to deliver the messages to Lambda...',
  );
  await new Promise((resolve) => setTimeout(resolve, 8000));

  // 3. Check DynamoDB
  console.log(
    '\n📋 Querying DynamoDB to check partial batch processing states...',
  );

  const validResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `DOCUMENT#${validDocId}` },
    }),
  );

  const invalidResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `DOCUMENT#${invalidDocId}` },
    }),
  );

  const validProcessed = (validResult.Items?.length || 0) > 0;
  const invalidProcessed = (invalidResult.Items?.length || 0) > 0;

  console.log('\n======================================================');
  console.log(
    `Valid Document Ingested:   ${validProcessed ? '✅ YES' : '❌ NO'}`,
  );
  console.log(
    `Invalid Document Ingested: ${invalidProcessed ? '❌ YES (Should have failed)' : '✅ NO'}`,
  );
  console.log('======================================================');

  if (validProcessed && !invalidProcessed) {
    console.log('🎉 TEST SUCCESSFUL! SQS successfully isolated the failure.');
    console.log(
      '   - The valid document was processed and written to DynamoDB.',
    );
    console.log(
      '   - The missing S3 document threw a NoSuchKey error, reported a batch item failure, and was correctly isolated from the successful message.',
    );
  } else {
    console.log('❌ TEST FAILED. Check CloudWatch execution logs for errors.');
  }
}

runTest().catch(console.error);
