import { api } from '@syncploy/sdk';
import { app } from './app';

/**
 * Syncploy API Endpoint for EHR Backend.
 * Replaces Docker/SAM container with native Lambda Function URL.
 */
export const ehrBackendFunction = api(
  {
    path: '/',
    ingress: 'function-url',
    timeout: '30s',
    concurrency: 2,
    cors: {
      allowOrigins: [
        'https://ehr-backend-frontend.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
      ],
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'X-Amz-Date',
        'X-Api-Key',
        'X-Origin-Verify',
        'X-Amz-Security-Token',
      ],
      allowMethods: ['*'],
    },
    environment: {
      API_KEY: process.env.API_KEY || '',
      OMOPHUB_API_KEY: process.env.OMOPHUB_API_KEY || '',
    },
  },
  async (_req, ctx) => {
    return app.handle(ctx.request);
  },
);
