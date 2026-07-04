import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import {
  DocumentEntity,
  AnnotationEntity,
  AuditLogEntity,
  RelationshipEntity,
} from '../database/entities';
import { PiiScrubberService } from '../annotations/pii-scrubber.service';

export class DocumentsService {
  private s3Client: S3Client;
  private sqsClient: SQSClient;
  private piiScrubber: PiiScrubberService;

  constructor() {
    this.s3Client = new S3Client({});
    this.sqsClient = new SQSClient({});
    this.piiScrubber = new PiiScrubberService();
  }

  async getDocuments() {
    try {
      const response = await DocumentEntity.query.bySk({}).go();
      return response.data || [];
    } catch (error) {
      console.error('Error fetching documents from DDB', error);
      return [];
    }
  }

  async getDocument(id: string) {
    const bucketName = process.env.DOCUMENTS_BUCKET_NAME;

    if (!bucketName) {
      // Mock fallback
      if (id === 'doc-001') {
        return {
          id: 'doc-001',
          text: 'Mock text',
          status: 'ready_for_review',
          s3Key: 'mock-key',
          annotations: [],
          relationships: [],
        };
      }
      throw new Error(`Document with id ${id} not found`);
    }

    // Query Document Entity, Annotation Entity, and Relationship Entity concurrently using ElectroDB
    const [docRes, annotationsRes, relationshipsRes] = await Promise.all([
      DocumentEntity.get({ id }).go(),
      AnnotationEntity.query.primary({ documentId: id }).go(),
      RelationshipEntity.query.primary({ documentId: id }).go(),
    ]);

    const metadata = docRes.data;
    if (!metadata) {
      throw new Error(`Document with id ${id} not found`);
    }

    const annotations = (annotationsRes.data || []).map((item) => ({
      ...item,
      id: item.annotationId || item.annotationId, // Map database key to frontend key 'id'
    }));

    const relationships = (relationshipsRes.data || []).map((item) => ({
      ...item,
      id: item.relationshipId,
    }));

    const getS3Command = new GetObjectCommand({
      Bucket: bucketName,
      Key: metadata.s3Key,
    });

    try {
      const s3Response = await this.s3Client.send(getS3Command);
      const text = (await s3Response.Body?.transformToString()) || '';

      // Cleanse the document text asynchronously using the ML-backed PII Scrubber
      const { scrubbedText } = await this.piiScrubber.scrubTextMl(text);

      return {
        ...metadata,
        text: scrubbedText,
        annotations,
        relationships,
      };
    } catch (error) {
      console.error('Error fetching from S3', error);
      throw new Error(`Document text for ${id} not found in S3`);
    }
  }

  async triggerAnalysis(docId: string, s3Key: string) {
    const queueUrl = process.env.ANNOTATION_QUEUE_URL;
    const bucketName = process.env.DOCUMENTS_BUCKET_NAME;

    if (!queueUrl || !bucketName) {
      console.warn(
        'Queue URL or Bucket Name not configured. Cannot queue analysis request.',
      );
      return;
    }

    const messageBody = {
      Records: [
        {
          s3: {
            bucket: {
              name: bucketName,
            },
            object: {
              key: s3Key,
            },
          },
        },
      ],
    };

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
    });

    console.log(`Queueing analysis request for Document: ${docId} on SQS...`);
    await this.sqsClient.send(command);
  }

  async fetchAndIngestDocument(id: string, bucketName: string, s3Key: string) {
    // 1. Fetch from S3 to get both content and metadata
    const getS3Command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    let text: string | undefined;
    let title: string | undefined;
    let category: string | undefined;

    try {
      const s3Response = await this.s3Client.send(getS3Command);
      text = await s3Response.Body?.transformToString();
      // S3 user-metadata keys are returned as lowercase by the SDK/S3
      const rawTitle = s3Response.Metadata?.title;
      const rawCategory = s3Response.Metadata?.category;
      title = rawTitle ? decodeURIComponent(rawTitle) : undefined;
      category = rawCategory ? decodeURIComponent(rawCategory) : undefined;
    } catch (error) {
      console.error(`Error fetching object from S3: ${s3Key}`, error);
      throw new Error(`Document text for ${id} not found in S3`);
    }

    // 2. Check if metadata exists in DynamoDB
    let metadata;
    try {
      const ddbResponse = await DocumentEntity.get({ id }).go();
      metadata = ddbResponse.data;
    } catch (error) {
      console.error(`Error checking metadata in DynamoDB for ${id}`, error);
    }

    if (!metadata) {
      console.log(
        `Document metadata for ${id} not found in DynamoDB. Creating record...`,
      );
      const newDoc = {
        id,
        title: title || `Document ${id}`,
        category: category || 'Uncategorized',
        s3Key: s3Key,
        status: 'ready_for_review',
        createdAt: new Date().toISOString(),
      };

      try {
        const response = await DocumentEntity.create(newDoc).go();
        metadata = response.data;

        // Log INGESTION_COMPLETED audit event
        try {
          await AuditLogEntity.create({
            logId: randomUUID(),
            documentId: id,
            actionType: 'INGESTION_COMPLETED',
            description: `Document "${newDoc.title}" ingested from S3. PII Scrubbing execution complete.`,
            createdAt: new Date().toISOString(),
          }).go();
        } catch (auditError) {
          console.error('Failed to log ingestion audit event', auditError);
        }
      } catch (error) {
        console.error(`Failed to save metadata to DynamoDB for ${id}`, error);
        throw error;
      }
    }

    // Cleanse the document text asynchronously using the ML-backed PII Scrubber
    const { scrubbedText } = await this.piiScrubber.scrubTextMl(text || '');

    return {
      ...metadata,
      text: scrubbedText,
    };
  }
}
