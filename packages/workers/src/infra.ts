import { ehrAnnotationQueue } from "shared";
import { handler as workerHandler } from "./worker";

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
      OMOPHUB_API_KEY: process.env.OMOPHUB_API_KEY || "",
      SAGEMAKER_ENDPOINT_NAME:
        process.env.SAGEMAKER_ENDPOINT_NAME || "gliner-relex-endpoint",
    },
  },
  async (_body, ctx) => {
    await workerHandler(ctx.event);
  }
);
