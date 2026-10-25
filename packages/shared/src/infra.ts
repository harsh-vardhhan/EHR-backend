import { Table, Bucket, Queue, Topic, Alarm, DeliveryStream } from "@syncploy/sdk";

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

// S3 Object-Locked Bucket for HIPAA compliance audit trail (account-scoped for global uniqueness)
export const ehrAuditLogsBucket = new Bucket("audit-logs", {
  objectLock: {
    mode: "COMPLIANCE",
    days: 1,
  },
  publicAccessBlock: true,
  accountScoped: true,
});

// Kinesis Firehose Delivery Stream for audit log streaming to compliance S3 bucket
export const ehrAuditDeliveryStream = new DeliveryStream("AuditDeliveryStream", {
  destination: ehrAuditLogsBucket,
  bufferingInterval: "900s",
  bufferingSize: "5MB",
  compression: "GZIP",
});

// Kinesis Firehose Delivery Stream for OMOP CDM clinical data lake
export const ehrOmopDeliveryStream = new DeliveryStream("OmopDeliveryStream", {
  destination: documentsBucket,
  prefix: "omop/",
  errorPrefix: "omop-failures/",
  bufferingInterval: "900s",
  bufferingSize: "5MB",
  compression: "GZIP",
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

// SNS Topic for DDoS Kill Switch alerts with email notification
export const ehrKillSwitchTopic = new Topic("ehr-kill-switch", {
  fifo: false,
  subscriptions: [
    {
      protocol: "email",
      endpoint: process.env.NOTIFICATION_EMAIL || "alert-notifications@example.com",
    },
  ],
});

// CloudWatch Alarm monitoring total Lambda traffic (Invocations + Throttles) via Metric Math
export const ehrLambdaTrafficAlarm = new Alarm("EhrLambdaTrafficAlarm", {
  threshold: 2000,
  evaluationPeriods: 1,
  comparison: "GreaterThanOrEqualToThreshold",
  description:
    "Triggered if backend Lambda requests (Invocations + Throttles) exceed 2000 in 1 minute. Triggers Kill Switch.",
  treatMissingData: "notBreaching",
  actions: [ehrKillSwitchTopic],
  metrics: [
    {
      id: "e1",
      expression: "m1 + m2",
      label: "TotalRequests",
      returnData: true,
    },
    {
      id: "m1",
      returnData: false,
      metricStat: {
        metric: {
          namespace: "AWS/Lambda",
          metricName: "Invocations",
          dimensions: {
            FunctionName: "ehrBackendFunction",
          },
        },
        period: "60s",
        stat: "Sum",
      },
    },
    {
      id: "m2",
      returnData: false,
      metricStat: {
        metric: {
          namespace: "AWS/Lambda",
          metricName: "Throttles",
          dimensions: {
            FunctionName: "ehrBackendFunction",
          },
        },
        period: "60s",
        stat: "Sum",
      },
    },
  ],
});
