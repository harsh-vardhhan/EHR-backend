import { APIGatewayClient, DeleteStageCommand } from '@aws-sdk/client-api-gateway';
import { SNSEvent, Context } from 'aws-lambda';

const client = new APIGatewayClient({});

/**
 * DDoS Kill Switch Lambda Handler.
 * Triggered by a CloudWatch Alarm routing to an SNS Topic.
 * Deletes the API Gateway 'prod' stage to stop billing instantly.
 */
export const handler = async (event: SNSEvent, context: Context) => {
  console.log('Kill Switch triggered by SNS event:', JSON.stringify(event, null, 2));

  const restApiId = process.env.API_GATEWAY_ID;
  const stageName = process.env.STAGE_NAME || 'prod';

  if (!restApiId) {
    const errorMsg = 'API_GATEWAY_ID environment variable is not set.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`[CIRCUIT BREAKER] Threat detected! Attempting to delete API Gateway Stage: "${stageName}" for API ID: "${restApiId}"`);

  try {
    const command = new DeleteStageCommand({
      restApiId,
      stageName,
    });
    
    const response = await client.send(command);
    console.log('[CIRCUIT BREAKER] Stage deleted successfully. Response:', JSON.stringify(response, null, 2));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'API Gateway stage deleted successfully.' }),
    };
  } catch (error: any) {
    console.error('[CIRCUIT BREAKER] Failed to delete API Gateway stage:', error);
    throw error;
  }
};
