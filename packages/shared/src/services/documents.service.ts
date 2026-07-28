import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import {
  DocumentEntity,
  AnnotationEntity,
  AuditLogEntity,
  RelationshipEntity,
  config,
} from 'shared';


import { randomUUID, createHash } from 'crypto';
import { config } from '../config';
import { AnnotationEntity, AuditLogEntity, RelationshipEntity } from '../database/annotations.entity';
import { DocumentEntity } from '../database/documents.entity';
import { type MedicalEntityLabel } from '../constants/labels';
import type { Document, Annotation } from '../database/schemas';

export class DocumentsService {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({});
  }

  async getDocuments(): Promise<Document[]> {
    try {
      const response = await DocumentEntity.query.bySk({}).go();
      return (response.data || []).map((doc) => ({
        ...doc,
        status: doc.status as Document['status'],
      }));
    } catch (error) {
      console.error('Error fetching documents from DDB', error);
      return [];
    }
  }

  async getDocument(id: string): Promise<Document> {
    const bucketName = config.documentsBucketName;

    if (!bucketName) {
      throw new Error(
        'DOCUMENTS_BUCKET_NAME environment variable is not configured',
      );
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
      source: item.source as Annotation['source'],
      status: item.status as Annotation['status'],
      label: item.label as MedicalEntityLabel,
      assertion: item.assertion as Annotation['assertion'],
      id: item.annotationId,
    }));

    const relationships = (relationshipsRes.data || []).map((item) => ({
      ...item,
      id: item.relationshipId,
    }));

    const getS3Command = new GetObjectCommand({
      Bucket: bucketName,
      Key: `scrubbed/${id}.txt`,
    });

    try {
      const s3Response = await this.s3Client.send(getS3Command);
      const text = (await s3Response.Body?.transformToString()) || '';

      return {
        ...metadata,
        status: metadata.status as Document['status'],
        text,
        annotations,
        relationships,
      };
    } catch (error) {
      console.error('Error fetching from S3', error);
      throw new Error(`Scrubbed document text for ${id} not found in S3`);
    }
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

    return {
      ...metadata,
      text: text || '',
    };
  }
}

export const documentsService = new DocumentsService();
