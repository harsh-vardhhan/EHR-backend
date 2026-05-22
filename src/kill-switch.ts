import {
  APIGatewayClient,
  UpdateStageCommand,
} from '@aws-sdk/client-api-gateway';
import { SNSEvent } from 'aws-lambda';

const client = new APIGatewayClient({});

/**
 * DDoS Kill Switch Lambda Handler.
 * Triggered by a CloudWatch Alarm routing to an SNS Topic.
 * Throttles API Gateway requests to 0 and disables CloudWatch logging/metrics to stop billing.
 */
export const handler = async (event: SNSEvent) => {
  console.log(
    'Kill Switch triggered by SNS event:',
    JSON.stringify(event, null, 2),
  );

  const restApiId = process.env.API_GATEWAY_ID;
  const stageName = process.env.STAGE_NAME || 'prod';

  if (!restApiId) {
    const errorMsg = 'API_GATEWAY_ID environment variable is not set.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log(
    `[CIRCUIT BREAKER] Threat detected! Attempting to throttle API Gateway Stage: "${stageName}" to 0 and disable logging for API ID: "${restApiId}"`,
  );

  try {
    const command = new UpdateStageCommand({
      restApiId,
      stageName,
      patchOperations: [
        {
          op: 'replace',
          path: '/*/*/throttling/rateLimit',
          value: '0',
        },
        {
          op: 'replace',
          path: '/*/*/throttling/burstLimit',
          value: '0',
        },
        {
          op: 'replace',
          path: '/*/*/logging/loglevel',
          value: 'OFF',
        },
        {
          op: 'replace',
          path: '/*/*/logging/dataTrace',
          value: 'false',
        },
        {
          op: 'replace',
          path: '/*/*/metrics/enabled',
          value: 'false',
        },
      ],
    });

    const response = await client.send(command);
    console.log(
      '[CIRCUIT BREAKER] Stage settings updated successfully. Response:',
      JSON.stringify(response, null, 2),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'API Gateway stage throttled to 0 and logging disabled successfully.',
      }),
    };
  } catch (error: any) {
    console.error(
      '[CIRCUIT BREAKER] Failed to update API Gateway stage settings:',
      error,
    );
    throw error;
  }
};
