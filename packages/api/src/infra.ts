import { api } from '@syncploy/sdk';
import '../../shared/src/syncploy-ext';
import { app } from './app';

/**
 * Syncploy API Endpoint for EHR Backend.
 * Replaces Docker/SAM container with native Lambda Function URL.
 */
export const ehrBackendFunction = api(
  {
    logicalId: 'EhrBackendFunction',
    roleLogicalId: 'EhrBackendFunctionRole',
    permissionLogicalId: 'EhrBackendFunctionUrlPublicPermissions',
    path: '/',
    ingress: 'function-url',
    container: {
      dockerfile: 'Dockerfile',
      context: '.',
    },
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
      PORT: '3000',
      API_KEY:
        process.env.API_KEY || 'A3zCOWmKgA3eQMvfev7unkY999oZw0X5bxBITz41',
      OMOPHUB_API_KEY:
        process.env.OMOPHUB_API_KEY ||
        'oh_e4cb7f363bf50d166db0656e4acf48836a5b2d0df68b11c5da738d5d825e5f40',
    },
  },
  async (_req, ctx) => {
    return app.handle(ctx.request);
  },
);
