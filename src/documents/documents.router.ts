import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { documentsService } from './documents.service';
import { annotationsService } from '../annotations/annotations.service';
import { z } from 'zod';
import { validateParam } from '../middleware/validation';

export const documentsApp = new Hono();

const idSchema = z
  .string()
  .min(1, 'id is required')
  .max(100, 'id is too long')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'id must only contain alphanumeric characters, dashes, or underscores',
  );

documentsApp.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();

  const status = err.message?.includes('not found') ? 404 : 500;
  return c.json(
    {
      error: status === 404 ? 'Not Found' : 'Internal Server Error',
      message: err.message,
    },
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

documentsApp.get('/:id/audit', validateParam('id', idSchema), async (c) => {
  const id = c.req.param('id');
  const auditLogs = await annotationsService.getAuditLogs(id);
  return c.json(auditLogs);
});

documentsApp.post('/:id/analyze', validateParam('id', idSchema), async (c) => {
  const id = c.req.param('id');
  const doc = (await documentsService.getDocument(id)) as any;
  await documentsService.triggerAnalysis(doc.id, doc.s3Key);
  return c.json({ success: true, message: 'Analysis queued successfully' });
});
