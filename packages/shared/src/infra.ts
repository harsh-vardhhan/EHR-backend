import { Table, Bucket, Queue } from "@syncploy/sdk";

// Single-table DynamoDB for all EHR data
export const ehrTable = new Table("ehr", {
  partitionKey: { name: "PK", type: "string" },
  sortKey: { name: "SK", type: "string" },
  billingMode: "PAY_PER_REQUEST",
  stream: "NEW_IMAGE",
  indexes: {
    SKIndex: {
      partitionKey: { name: "SK", type: "string" },
      sortKey: { name: "PK", type: "string" },
      projection: "ALL",
    },
    GSI1Index: {
      partitionKey: { name: "GSI1PK", type: "string" },
      sortKey: { name: "GSI1SK", type: "string" },
      projection: "ALL",
    },
  },
});

// S3 Bucket for medical documents with EventBridge notification enabled
export const documentsBucket = new Bucket("documents", {
  eventBridge: true,
  publicAccessBlock: true,
});

// SQS Annotation Queue with Dead Letter Queue
export const ehrAnnotationQueue = new Queue("ehr-annotation", {
  visibilityTimeout: "180s",
  deadLetterQueue: {
    maxReceiveCount: 3,
  },
});

// EventBridge routing rule: S3 ObjectCreated events under 'documents/' to SQS
documentsBucket.on("objectCreated", ehrAnnotationQueue, {
  prefix: "documents/",
});
