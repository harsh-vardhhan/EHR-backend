import { ehrAnnotationQueue, ehrKillSwitchTopic, ehrTable } from "shared";
import { handler as workerHandler } from "./worker";
import { handler as killSwitchHandler } from "./kill-switch";
import { handler as auditConsumerHandler } from "./audit-consumer";
import { handler as omopPipelineHandler } from "./omop-pipeline";

/**
 * Syncploy Queue Consumer for Clinical Data Extraction.
 * Consumes events from EhrAnnotationQueue with DLQ and SageMaker execution permissions.
 */
export const ehrAnnotationWorkerFunction = ehrAnnotationQueue.consumer(
  {
    batchSize: 5,
    timeout: "120s",
    concurrency: 2,
    policies: [
      {
        actions: ["sagemaker:InvokeEndpoint"],
        resources: ["*"],
      },
    ],
    environment: {
      ...(process.env.OMOPHUB_API_KEY ? { OMOPHUB_API_KEY: process.env.OMOPHUB_API_KEY } : {}),
      SAGEMAKER_ENDPOINT_NAME:
        process.env.SAGEMAKER_ENDPOINT_NAME || "gliner-relex-endpoint",
    },
  },
  async (_body, ctx) => {
    // Process single record and return failure result to preserve retry semantics
    return await workerHandler({ Records: [ctx.record] });
  }
);

/**
 * Syncploy DDoS Kill Switch Circuit Breaker.
 * Triggered by SNS topic notifications when Lambda traffic exceeds threshold.
 * Throttles backend concurrency to 0.
 * BACKEND_FUNCTION_NAME is automatically injected by Syncploy compiler.
 */
export const ehrKillSwitchFunction = ehrKillSwitchTopic.subscribe(
  {
    timeout: "30s",
    memory: "128MB",
    policies: [
      {
        actions: [
          "lambda:PutFunctionConcurrency",
          "lambda:DeleteFunctionConcurrency",
        ],
        resources: ["*"],
      },
    ],
  },
  async (_message, ctx) => {
    await killSwitchHandler(ctx.event);
  }
);

/**
 * Syncploy Audit Stream Pipeline.
 * Consumes DynamoDB Streams from EhrTable and forwards audit logs to Firehose.
 * Disabled by default matching SAM template EnableStreamingPipelines: "false".
 */
export const ehrAuditStreamFunction = ehrTable.stream(
  {
    batchSize: 100,
    startingPosition: "LATEST",
    enabled: false,
    timeout: "30s",
    memory: "128MB",
    policies: [
      {
        actions: ["firehose:PutRecord", "firehose:PutRecordBatch"],
        resources: ["*"],
      },
    ],
    environment: {
      AUDIT_DELIVERY_STREAM_NAME: process.env.AUDIT_DELIVERY_STREAM_NAME || "",
    },
  },
  async (_record, ctx) => {
    return await auditConsumerHandler(ctx.event);
  }
);

/**
 * Syncploy OMOP CDM Data Lake Pipeline.
 * Consumes DynamoDB Streams from EhrTable and streams OMOP entities to Firehose.
 * Disabled by default matching SAM template EnableStreamingPipelines: "false".
 */
export const ehrOmopPipelineFunction = ehrTable.stream(
  {
    batchSize: 100,
    startingPosition: "LATEST",
    enabled: false,
    timeout: "30s",
    memory: "128MB",
    policies: [
      {
        actions: ["firehose:PutRecord", "firehose:PutRecordBatch"],
        resources: ["*"],
      },
    ],
    environment: {
      OMOP_DELIVERY_STREAM_NAME: process.env.OMOP_DELIVERY_STREAM_NAME || "",
    },
  },
  async (_record, ctx) => {
    await omopPipelineHandler(ctx.event);
  }
);
