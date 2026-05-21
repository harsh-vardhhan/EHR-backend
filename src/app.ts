import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { documentsApp } from './documents/documents.router';
import { annotationsApp } from './annotations/annotations.router';

export const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.FRONTEND_URL || '*',
  allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Route registration
app.route('/documents', documentsApp);
app.route('/annotations', annotationsApp);

// Root route
app.get('/', (c) => c.json({ status: 'ok', framework: 'hono' }));
