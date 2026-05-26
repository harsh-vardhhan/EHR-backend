import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export class DocumentsService {
  private ddbClient: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private s3Client: S3Client;
  private sqsClient: SQSClient;

  constructor() {
    this.ddbClient = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(this.ddbClient);
    this.s3Client = new S3Client({});
    this.sqsClient = new SQSClient({});
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
        return {
          id: 'doc-001',
          text: 'Mock text',
          status: 'ready_for_review',
          s3Key: 'mock-key',
        };
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
    const tableName = process.env.DOCUMENTS_TABLE_NAME;
    if (!tableName) {
      throw new Error('DOCUMENTS_TABLE_NAME not set');
    }

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
      title = s3Response.Metadata?.title;
      category = s3Response.Metadata?.category;
    } catch (error) {
      console.error(`Error fetching object from S3: ${s3Key}`, error);
      throw new Error(`Document text for ${id} not found in S3`);
    }

    // 2. Check if metadata exists in DynamoDB
    const getDdbCommand = new GetCommand({
      TableName: tableName,
      Key: { id },
    });

    let metadata;
    try {
      const ddbResponse = await this.docClient.send(getDdbCommand);
      metadata = ddbResponse.Item;
    } catch (error) {
      console.error(`Error checking metadata in DynamoDB for ${id}`, error);
    }

    if (!metadata) {
      console.log(`Document metadata for ${id} not found in DynamoDB. Creating record...`);
      metadata = {
        id,
        title: title || `Document ${id}`,
        category: category || 'Uncategorized',
        s3Key: s3Key,
        status: 'ready_for_review',
        createdAt: new Date().toISOString(),
      };

      const putDdbCommand = new PutCommand({
        TableName: tableName,
        Item: metadata,
      });

      try {
        await this.docClient.send(putDdbCommand);
      } catch (error) {
        console.error(`Failed to save metadata to DynamoDB for ${id}`, error);
        throw error;
      }
    }

    return {
      ...metadata,
      text,
    };
  }
}
