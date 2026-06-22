import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { documentsService } from '../services';
import { z } from 'zod';
import type { MiddlewareHandler } from 'hono';

export const documentsApp = new Hono();

// Reusable parameter validator middleware
const validateParam = (paramName: string, schema: z.ZodSchema): MiddlewareHandler => {
  return async (c, next) => {
    const value = c.req.param(paramName);
    const result = schema.safeParse(value);
    if (!result.success) {
      return c.json(
        {
          error: 'Bad Request',
          message: `Invalid parameter: ${paramName}`,
          details: result.error.errors.map((err) => err.message),
        },
        400,
      );
    }
    await next();
  };
};

const idSchema = z
  .string()
  .min(1, 'id is required')
  .max(100, 'id is too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'id must only contain alphanumeric characters, dashes, or underscores');

documentsApp.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();

  const status = err.message?.includes('not found') ? 404 : 500;
  return c.json(
    { error: status === 404 ? 'Not Found' : 'Internal Server Error', message: err.message },
    status,
  );
});

documentsApp.get('/', async (c) => {
  const docs = await documentsService.getDocuments();
  return c.json(docs);
});

documentsApp.get('/:id', validateParam('id', idSchema), async (c) => {
  const doc = await documentsService.getDocument(c.req.param('id'));
  return c.json(doc);
});

documentsApp.post('/:id/analyze', validateParam('id', idSchema), async (c) => {
  const id = c.req.param('id');
  const doc = (await documentsService.getDocument(id)) as any;
  await documentsService.triggerAnalysis(doc.id, doc.s3Key);
  return c.json({ success: true, message: 'Analysis queued successfully' });
});
