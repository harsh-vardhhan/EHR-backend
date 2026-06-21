import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { documentsService } from '../services';

export const documentsApp = new Hono();

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

documentsApp.get('/:id', async (c) => {
  const doc = await documentsService.getDocument(c.req.param('id'));
  return c.json(doc);
});

documentsApp.post('/:id/analyze', async (c) => {
  const id = c.req.param('id');
  const doc = (await documentsService.getDocument(id)) as any;
  await documentsService.triggerAnalysis(doc.id, doc.s3Key);
  return c.json({ success: true, message: 'Analysis queued successfully' });
});
