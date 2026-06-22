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

function logJson(level: 'info' | 'success' | 'warn' | 'error', event: string, data: Record<string, any> = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...data }));
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isS3Seeded(): Promise<boolean> {
  if (!BUCKET_NAME) return false;

  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: 'documents/',
    MaxKeys: 1,
  });

  try {
    const response = await s3Client.send(command);
    return (response.Contents?.length || 0) > 0;
  } catch (error: any) {
    logJson('warn', 's3_check_failed', { error: error.message });
    return false;
  }
}

async function seed() {
  if (!BUCKET_NAME) {
    logJson('error', 'seed_failed_credentials', { reason: 'missing_bucket_name_env' });
    process.exit(1);
  }

  logJson('info', 'seed_check_start', { bucket: BUCKET_NAME });
  
  if (await isS3Seeded()) {
    logJson('success', 'seed_skipped', { reason: 's3_already_contains_documents' });
    return;
  }

  const notesPath = path.join(__dirname, 'notes.json');
  const notesData = fs.readFileSync(notesPath, 'utf8');
  const notes = JSON.parse(notesData);

  logJson('info', 'seed_upload_start', { total_documents: notes.length });

  for (const note of notes) {
    const s3Key = `documents/${note.id}.txt`;
    logJson('info', 'seed_upload_item', { docId: note.id, key: s3Key });

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: note.text,
          ContentType: 'text/plain',
          Metadata: {
            title: encodeURIComponent(note.title),
            category: encodeURIComponent(note.category),
          },
        }),
      );
      logJson('success', 'seed_upload_success', { docId: note.id, key: s3Key });
    } catch (error: any) {
      logJson('error', 'seed_upload_failed', { docId: note.id, key: s3Key, error: error.message });
      throw error;
    }

    await sleep(200);
  }

  logJson('success', 'seed_complete', { summary: { documents_seeded: notes.length } });
}

seed().catch((err) => {
  logJson('error', 'seed_failed_fatal', { error: err.message });
  process.exit(1);
});
