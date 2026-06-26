import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { DocumentEntity, AnnotationEntity } from '../database/entities';
import { extractClinicalEntities } from '../annotations/extractor.client';
import { findEntityOffsets } from '../annotations/mastra.service';
import { OmopHubClient } from '../annotations/omophub.client';

const BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME;

const s3Client = new S3Client({});
const omophubClient = new OmopHubClient();

function logJson(
  level: 'info' | 'success' | 'warn' | 'error',
  event: string,
  data: Record<string, any> = {},
) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...data,
    }),
  );
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
    logJson('error', 'seed_failed_credentials', {
      reason: 'missing_bucket_name_env',
    });
    process.exit(1);
  }

  logJson('info', 'seed_check_start', { bucket: BUCKET_NAME });

  if (await isS3Seeded()) {
    logJson('success', 'seed_skipped', {
      reason: 's3_already_contains_documents',
    });
    return;
  }

  const notesPath = path.join(__dirname, 'notes.json');
  const notesData = fs.readFileSync(notesPath, 'utf8');
  const notes = JSON.parse(notesData);

  logJson('info', 'seed_upload_start', { total_documents: notes.length });

  for (const note of notes) {
    const s3Key = `documents/${note.id}.txt`;
    logJson('info', 'seed_processing_note', { docId: note.id, key: s3Key });

    try {
      // 1. Upload Note text to S3
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
      logJson('success', 'seed_s3_upload_success', { docId: note.id, key: s3Key });

      // 2. Ingest Document Metadata record directly to DynamoDB
      await DocumentEntity.create({
        id: note.id,
        title: note.title,
        category: note.category,
        s3Key,
        status: 'ready_for_review',
        createdAt: new Date().toISOString(),
      }).go();
      logJson('success', 'seed_db_document_success', { docId: note.id });

      // 3. Extract entities via LLM (with 3-attempt retry loop for rate-limiting protection)
      logJson('info', 'seed_llm_extraction_start', { docId: note.id });
      let entities: any[] = [];
      let attempts = 3;
      while (attempts > 0) {
        try {
          entities = await extractClinicalEntities(note.text);
          break;
        } catch (err: any) {
          attempts--;
          logJson('warn', 'seed_llm_extraction_attempt_failed', {
            docId: note.id,
            error: err.message,
            attempts_remaining: attempts,
          });
          if (attempts === 0) throw err;
          await sleep(15000);
        }
      }
      logJson('success', 'seed_llm_extraction_success', { docId: note.id, count: entities.length });

      // 4. Resolve standard concept codes via OMOPHub
      logJson('info', 'seed_omophub_resolution_start', { docId: note.id });
      const queries = entities.map((entity) => ({
        text: entity.text,
        label: entity.label,
      }));
      const resolvedMap = await omophubClient.resolveBulkConcepts(queries);
      logJson('success', 'seed_omophub_resolution_success', { docId: note.id });

      // 5. Save verified annotations directly to DynamoDB
      const timestamp = new Date().toISOString();
      const annotationsToCreate: any[] = [];

      for (const entity of entities) {
        const offsets = findEntityOffsets(note.text, entity.text);
        if (!offsets) {
          logJson('warn', 'seed_offset_not_found', { docId: note.id, entity: entity.text });
          continue;
        }

        const resolved = resolvedMap.get(entity.text.toLowerCase());
        const conceptCode = resolved?.conceptCode || entity.conceptCode;

        annotationsToCreate.push({
          documentId: note.id,
          annotationId: randomUUID(),
          text: entity.text,
          label: entity.label,
          startOffset: offsets.startOffset,
          endOffset: offsets.endOffset,
          source: 'llm' as const,
          status: 'suggested' as const,
          confidence: entity.confidence,
          assertion: entity.assertion,
          conceptCode,
          createdAt: timestamp,
        });
      }

      if (annotationsToCreate.length > 0) {
        logJson('info', 'seed_db_annotations_write_start', { docId: note.id, count: annotationsToCreate.length });
        await AnnotationEntity.put(annotationsToCreate).go();
        logJson('success', 'seed_db_annotations_write_success', { docId: note.id });
      }
    } catch (error: any) {
      logJson('error', 'seed_processing_failed', {
        docId: note.id,
        key: s3Key,
        error: error.message,
      });
      throw error;
    }

    // Rate-limiting delay to sleep 12 seconds between note processings to respect Groq TPM/RPM limits
    await sleep(12000);
  }

  logJson('success', 'seed_complete', {
    summary: { documents_seeded: notes.length },
  });
}

seed().catch((err) => {
  logJson('error', 'seed_failed_fatal', { error: err.message });
  process.exit(1);
});
