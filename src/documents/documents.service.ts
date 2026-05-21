import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export class DocumentsService {
  private ddbClient: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private s3Client: S3Client;

  constructor() {
    this.ddbClient = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(this.ddbClient);
    this.s3Client = new S3Client({});
  }

  async getDocuments() {
    const tableName = process.env.DOCUMENTS_TABLE_NAME;
    if (!tableName) {
      return []; // Fallback or mock list if not configured
    }

    const command = new ScanCommand({
      TableName: tableName,
    });

    try {
      const response = await this.docClient.send(command);
      return response.Items || [];
    } catch (error) {
      console.error('Error fetching documents from DDB', error);
      return [];
    }
  }

  async getDocument(id: string) {
    const tableName = process.env.DOCUMENTS_TABLE_NAME;
    const bucketName = process.env.DOCUMENTS_BUCKET_NAME;

    if (!tableName || !bucketName) {
      // Mock fallback
      if (id === 'doc-001') {
        return { id: 'doc-001', text: 'Mock text', status: 'ready_for_review' };
      }
      throw new Error(`Document with id ${id} not found`);
    }

    const getDdbCommand = new GetCommand({
      TableName: tableName,
      Key: { id },
    });

    const ddbResponse = await this.docClient.send(getDdbCommand);
    const metadata = ddbResponse.Item;

    if (!metadata) {
      throw new Error(`Document with id ${id} not found`);
    }

    const getS3Command = new GetObjectCommand({
      Bucket: bucketName,
      Key: metadata.s3Key,
    });

    try {
      const s3Response = await this.s3Client.send(getS3Command);
      const text = await s3Response.Body?.transformToString();

      return {
        ...metadata,
        text,
      };
    } catch (error) {
      console.error('Error fetching from S3', error);
      throw new Error(`Document text for ${id} not found in S3`);
    }
  }
}
