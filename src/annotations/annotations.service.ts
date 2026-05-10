import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

export interface Annotation {
  annotationId: string;
  documentId: string;
  text: string;
  label: 'Condition' | 'Medication' | 'Symptom' | 'Procedure';
  startOffset: number;
  endOffset: number;
  createdAt: string;
  source: 'human' | 'llm';
  status?: 'suggested' | 'accepted' | 'rejected' | 'corrected';
  confidence?: number;
}

@Injectable()
export class AnnotationsService {
  private ddbClient: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;

  constructor() {
    this.ddbClient = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(this.ddbClient);
  }

  async getAnnotationsByDocument(documentId: string): Promise<Annotation[]> {
    const tableName = process.env.ANNOTATIONS_TABLE_NAME;
    if (!tableName) return [];

    const command = new QueryCommand({
      TableName: tableName,
      IndexName: 'DocumentIdIndex',
      KeyConditionExpression: 'documentId = :docId',
      ExpressionAttributeValues: {
        ':docId': documentId,
      },
    });

    try {
      const response = await this.docClient.send(command);
      return (response.Items as Annotation[]) || [];
    } catch (error) {
      console.error('Error fetching annotations', error);
      return [];
    }
  }

  async createAnnotation(
    data: Omit<Annotation, 'annotationId' | 'createdAt'>,
  ): Promise<Annotation> {
    const tableName = process.env.ANNOTATIONS_TABLE_NAME;

    const newAnnotation: Annotation = {
      ...data,
      annotationId: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    if (!tableName) return newAnnotation;

    const command = new PutCommand({
      TableName: tableName,
      Item: newAnnotation,
    });

    await this.docClient.send(command);
    return newAnnotation;
  }

  async updateAnnotation(
    annotationId: string,
    updates: Partial<Annotation>,
  ): Promise<Annotation> {
    const tableName = process.env.ANNOTATIONS_TABLE_NAME;
    if (!tableName) throw new NotFoundException('Table not configured');

    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'annotationId' && key !== 'documentId') {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    }

    if (updateExpressions.length === 0) {
      return {} as Annotation; // Or fetch it
    }

    const command = new UpdateCommand({
      TableName: tableName,
      Key: { annotationId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    try {
      const response = await this.docClient.send(command);
      return response.Attributes as Annotation;
    } catch (error) {
      console.error('Error updating annotation', error);
      throw new NotFoundException(
        `Annotation with id ${annotationId} not found`,
      );
    }
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    const tableName = process.env.ANNOTATIONS_TABLE_NAME;
    if (!tableName) return;

    const command = new DeleteCommand({
      TableName: tableName,
      Key: { annotationId },
    });

    try {
      await this.docClient.send(command);
    } catch (error) {
      console.error('Error deleting annotation', error);
      throw new NotFoundException(
        `Annotation with id ${annotationId} not found`,
      );
    }
  }
}
