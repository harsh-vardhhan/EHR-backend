import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { documentsApp } from './documents/documents.router';
import { annotationsApp } from './annotations/annotations.router';

export const app = new Hono();

if (process.env.NODE_ENV !== 'production') {
  app.use('*', logger());
}
app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL || '*',
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.use('*', async (c, next) => {
  if (c.req.path === '/' || c.req.method === 'OPTIONS') {
    await next();
    return;
  }

  const apiKey = c.req.header('x-api-key');
  const expectedApiKey = process.env.API_KEY;

  if (!apiKey || apiKey !== expectedApiKey) {
    return c.json(
      { error: 'Unauthorized', message: 'Invalid or missing API Key' },
      401,
    );
  }

  await next();
});

app.route('/documents', documentsApp);
app.route('/annotations', annotationsApp);

app.get('/', (c) => c.json({ status: 'ok', framework: 'hono' }));
