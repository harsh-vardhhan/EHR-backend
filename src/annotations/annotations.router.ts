import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { annotationsService } from '../services';

export const annotationsApp = new Hono();

annotationsApp.get('/', async (c) => {
  const documentId = c.req.query('documentId');
  try {
    const annotations = await annotationsService.getAnnotationsByDocument(
      documentId || '',
    );
    return c.json(annotations);
  } catch (error: any) {
    throw new HTTPException(500, { message: error.message });
  }
});

annotationsApp.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const newAnnotation = await annotationsService.createAnnotation(body);
    return c.json(newAnnotation, 201);
  } catch (error: any) {
    throw new HTTPException(400, { message: error.message });
  }
});

annotationsApp.patch('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const updatedAnnotation = await annotationsService.updateAnnotation(
      id,
      body,
    );
    return c.json(updatedAnnotation);
  } catch (error: any) {
    throw new HTTPException(404, { message: error.message });
  }
});
