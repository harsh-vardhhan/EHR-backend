import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { rateLimit } from 'elysia-rate-limit';
import { documentsApp } from './documents/documents.router';
import { annotationsApp } from './annotations/annotations.router';

const ALLOWED_ORIGINS = new Set([
  'https://ehr-backend-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]);

export const app = new Elysia()
  .use(
    rateLimit({
      duration: 60000,
      max: 60,
      generator: (req) =>
        req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      errorResponse: {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      },
    }),
  )
  .use(
    !process.env.AWS_LAMBDA_FUNCTION_NAME
      ? cors({
          origin: Array.from(ALLOWED_ORIGINS),
          allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Amz-Date',
            'X-Api-Key',
            'X-Origin-Verify',
            'X-Amz-Security-Token',
          ],
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        })
      : (x) => x,
  )
  .onRequest(({ request }) => {
    if (process.env.NODE_ENV !== 'production') {
      const url = new URL(request.url);
      console.log(`[Elysia Logger] ${request.method} ${url.pathname}`);
    }
  })
  .onBeforeHandle(({ request, set }) => {
    const url = new URL(request.url);
    if (url.pathname === '/' || request.method === 'OPTIONS') {
      return;
    }

    const origin = request.headers.get('origin');
    const originSecret = request.headers.get('x-origin-verify');

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      set.status = 403;
      return { error: 'Forbidden', message: 'Unauthorized origin' };
    }

    if (
      process.env.ORIGIN_VERIFY_SECRET &&
      originSecret !== process.env.ORIGIN_VERIFY_SECRET
    ) {
      set.status = 403;
      return {
        error: 'Forbidden',
        message: 'Invalid origin verification secret',
      };
    }

    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.API_KEY;

    if (expectedApiKey && (!apiKey || apiKey !== expectedApiKey)) {
      set.status = 401;
      return { error: 'Unauthorized', message: 'Invalid or missing API Key' };
    }
  })
  .use(documentsApp)
  .use(annotationsApp)
  .get('/', () => ({ status: 'ok', framework: 'elysia' }));

export type App = typeof app;
