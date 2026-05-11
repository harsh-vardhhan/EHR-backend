import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME;
const DOC_TABLE_NAME = process.env.DOCUMENTS_TABLE_NAME;
const ANN_TABLE_NAME = process.env.ANNOTATIONS_TABLE_NAME;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeDocument(text: string) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not set');
  }

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: 'You are a clinical NLP system.',
          },
          {
            role: 'user',
            content: `Extract medical entities from the following text and classify them strictly into one of these professional healthcare labels: Clinical Condition, Medication Statement, Clinical Finding, or Medical Procedure.

Important: You must output your response as a valid JSON object matching this schema:
{
  "entities": [
    { "text": string, "label": "Clinical Condition" | "Medication Statement" | "Clinical Finding" | "Medical Procedure", "confidence": number, "startOffset": number, "endOffset": number }
  ]
}

Note: Do not calculate exact character offsets. Always set startOffset and endOffset to 0 for every entity. Our backend will handle the exact offset calculation.

Example output:
{
  "entities": [
    { "text": "chest pain", "label": "Clinical Finding", "confidence": 95, "startOffset": 0, "endOffset": 0 }
  ]
}

Do not include any markdown formatting, backticks, or conversational text. Return only the JSON object. Do not over-reason. Output the final JSON immediately.

Text: "${text}"`,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Groq API error: ${await response.text()}`);
  }

  const data = await response.json();
  let generatedText = data.choices[0].message.content || '';

  const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    generatedText = jsonMatch[0];
  }

  return JSON.parse(generatedText);
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

    console.log(`Analyzing ${note.id} with Groq...`);
    try {
      const analysis = await analyzeDocument(note.text);

      const entities = analysis.entities || [];
      for (const entity of entities) {
        let actualStart = 0;
        let actualEnd = 0;

        const escapedText = entity.text.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        const regexPattern = escapedText.replace(/\\s+|\\n/g, '\\s+');
        const regex = new RegExp(regexPattern, 'i');
        const match = note.text.match(regex);

        if (match && match.index !== undefined) {
          actualStart = match.index;
          actualEnd = match.index + match[0].length;

          await docClient.send(
            new PutCommand({
              TableName: ANN_TABLE_NAME,
              Item: {
                annotationId: randomUUID(),
                documentId: note.id,
                text: entity.text,
                label: entity.label,
                startOffset: actualStart,
                endOffset: actualEnd,
                confidence: entity.confidence,
                source: 'llm',
                status: 'suggested',
                createdAt: new Date().toISOString(),
              },
            }),
          );
        } else {
          console.warn(`Entity text not found in document: ${entity.text}`);
        }
      }
    } catch (e) {
      console.error(`Error analyzing ${note.id}`, e);
    }

    // Rate limiting
    await sleep(2000);
  }

  console.log('Seeding complete!');
}

seed().catch(console.error);
