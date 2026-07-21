import {
  LambdaClient,
  PutFunctionConcurrencyCommand,
} from '@aws-sdk/client-lambda';
import { SNSEvent } from 'aws-lambda';

const client = new LambdaClient({});

/**
 * DDoS Kill Switch Lambda Handler.
 * Triggered by a CloudWatch Alarm routing to an SNS Topic.
 * Throttles backend Lambda function execution to 0 to stop billing and downstream processing.
 */
export const handler = async (event: SNSEvent) => {
  console.log(
    'Kill Switch triggered by SNS event:',
    JSON.stringify(event, null, 2),
  );

  const functionName = process.env.BACKEND_FUNCTION_NAME;

  if (!functionName) {
    const errorMsg = 'BACKEND_FUNCTION_NAME environment variable is not set.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log(
    `[CIRCUIT BREAKER] Threat detected! Attempting to set reserved concurrency to 0 for function: "${functionName}"`,
  );

  try {
    const command = new PutFunctionConcurrencyCommand({
      FunctionName: functionName,
      ReservedConcurrentExecutions: 0,
    });

    const response = await client.send(command);
    console.log(
      '[CIRCUIT BREAKER] Function concurrency updated to 0 successfully. Response:',
      JSON.stringify(response, null, 2),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Lambda reserved concurrency throttled to 0 successfully.',
      }),
    };
  } catch (error: unknown) {
    console.error(
      '[CIRCUIT BREAKER] Failed to update Lambda function concurrency settings:',
      error,
    );
    throw error;
  }
};
