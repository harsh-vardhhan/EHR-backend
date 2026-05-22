import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { documentsService } from '../services';

export const documentsApp = new Hono();

documentsApp.get('/', async (c) => {
  try {
    const docs = await documentsService.getDocuments();
    return c.json(docs);
  } catch (error: any) {
    throw new HTTPException(500, { message: error.message });
  }
});

documentsApp.get('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const doc = await documentsService.getDocument(id);
    return c.json(doc);
  } catch (error: any) {
    throw new HTTPException(404, { message: error.message });
  }
});

documentsApp.post('/:id/analyze', async (c) => {
  const id = c.req.param('id');
  try {
    const doc = (await documentsService.getDocument(id)) as any;
    await documentsService.triggerAnalysis(
      doc.id as string,
      doc.s3Key as string,
    );
    return c.json({ success: true, message: 'Analysis queued successfully' });
  } catch (error: any) {
    throw new HTTPException(404, { message: error.message });
  }
});
