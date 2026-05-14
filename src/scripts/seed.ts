import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME;
const DOC_TABLE_NAME = process.env.DOCUMENTS_TABLE_NAME;
const ANN_TABLE_NAME = process.env.ANNOTATIONS_TABLE_NAME;

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isS3Seeded() {
  if (!BUCKET_NAME) return false;

  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: 'documents/',
    MaxKeys: 1,
  });

  try {
    const response = await s3Client.send(command);
    return (response.Contents?.length || 0) > 0;
  } catch (error) {
    console.warn('Error checking S3 status, assuming not seeded:', error);
    return false;
  }
}

async function seed() {
  if (!BUCKET_NAME || !DOC_TABLE_NAME || !ANN_TABLE_NAME) {
    console.error(
      'Missing AWS environment variables. Ensure BUCKET_NAME, DOC_TABLE_NAME, ANN_TABLE_NAME are set.',
    );
    process.exit(1);
  }

  // Check if already seeded
  console.log('Checking if S3 already has data...');
  if (await isS3Seeded()) {
    console.log(
      'S3 already contains documents. Skipping seeding to prevent duplicates.',
    );
    return;
  }

  const notesPath = path.join(__dirname, 'notes.json');
  const notesData = fs.readFileSync(notesPath, 'utf8');
  const notes = JSON.parse(notesData);

  for (const note of notes) {
    const s3Key = `documents/${note.id}.txt`;

    console.log(`Uploading ${note.id} to S3...`);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: note.text,
        ContentType: 'text/plain',
      }),
    );

    console.log(`Saving ${note.id} metadata to DynamoDB...`);
    await docClient.send(
      new PutCommand({
        TableName: DOC_TABLE_NAME,
        Item: {
          id: note.id,
          title: note.title,
          category: note.category,
          s3Key: s3Key,
          status: 'ready_for_review',
          createdAt: new Date().toISOString(),
        },
      }),
    );

    console.log(`Seeded ${note.id}. Pipeline will trigger for analysis.`);

    // Minimal delay for S3 throughput stability
    await sleep(200);
  }

  console.log('Seeding complete!');
}

seed().catch(console.error);
