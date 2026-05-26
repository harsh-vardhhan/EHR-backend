import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

const BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME;

const s3Client = new S3Client({});

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
  if (!BUCKET_NAME) {
    console.error(
      'Missing AWS environment variables. Ensure DOCUMENTS_BUCKET_NAME is set.',
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

    console.log(`Uploading ${note.id} to S3 with metadata...`);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: note.text,
        ContentType: 'text/plain',
        Metadata: {
          title: note.title,
          category: note.category,
        },
      }),
    );

    console.log(`Seeded ${note.id}. Pipeline will trigger ingestion and analysis.`);

    // Minimal delay for S3 throughput stability
    await sleep(200);
  }

  console.log('Seeding complete!');
}

seed().catch(console.error);
