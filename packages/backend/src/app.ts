import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { documentsApp } from './documents/documents.router';
import { annotationsApp } from './annotations/annotations.router';

export const app = new Elysia()
  .use(
    cors({
      origin: process.env.FRONTEND_URL || '*',
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Amz-Date',
        'X-Api-Key',
        'X-Amz-Security-Token',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
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

    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.API_KEY;

    if (!apiKey || apiKey !== expectedApiKey) {
      set.status = 401;
      return { error: 'Unauthorized', message: 'Invalid or missing API Key' };
    }
  })
  .use(documentsApp)
  .use(annotationsApp)
  .get('/', () => ({ status: 'ok', framework: 'elysia' }));

export type App = typeof app;
