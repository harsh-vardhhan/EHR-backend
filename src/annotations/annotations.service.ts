import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';

export interface Annotation {
  annotationId: string;
  documentId: string;
  text: string;
  label:
    | 'Clinical Condition'
    | 'Medication Statement'
    | 'Clinical Finding'
    | 'Medical Procedure';
  startOffset: number;
  endOffset: number;
  createdAt: string;
  source: 'human' | 'llm';
  status?: 'suggested' | 'accepted' | 'rejected' | 'corrected';
  confidence?: number;
}

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
    const documentsTableName = process.env.DOCUMENTS_TABLE_NAME;

    if (documentsTableName) {
      const getDocCommand = new GetCommand({
        TableName: documentsTableName,
        Key: { id: data.documentId },
      });
      const docRes = await this.docClient.send(getDocCommand);
      if (!docRes.Item) {
        throw new Error(`Document with id ${data.documentId} not found`);
      }
    }

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
    if (!tableName) throw new Error('Table not configured');

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
      throw new Error(`Annotation with id ${annotationId} not found`);
    }
  }
}
