import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { annotationsService } from '../services';
import { MEDICAL_ENTITIES } from '../constants/labels';

export const annotationsApp = new Hono();

const createAnnotationSchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  text: z
    .string()
    .min(1, 'text is required')
    .max(500, 'text must be 500 characters or less'),
  label: z.enum(
    [
      MEDICAL_ENTITIES.CONDITION,
      MEDICAL_ENTITIES.MEDICATION,
      MEDICAL_ENTITIES.FINDING,
      MEDICAL_ENTITIES.PROCEDURE,
    ],
    {
      errorMap: () => ({ message: 'Invalid label type' }),
    },
  ),
  startOffset: z
    .number()
    .int()
    .nonnegative('startOffset must be a non-negative integer'),
  endOffset: z
    .number()
    .int()
    .nonnegative('endOffset must be a non-negative integer'),
  source: z.enum(['human', 'llm'], {
    errorMap: () => ({ message: 'source must be either "human" or "llm"' }),
  }),
  status: z.enum(['suggested', 'accepted', 'rejected', 'corrected']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

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
    const result = createAnnotationSchema.safeParse(body);

    if (!result.success) {
      const errors = result.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return c.json({ error: 'Validation failed', message: errors }, 400);
    }

    const { startOffset, endOffset } = result.data;
    if (startOffset > endOffset) {
      return c.json(
        {
          error: 'Validation failed',
          message: 'startOffset must be less than or equal to endOffset',
        },
        400,
      );
    }

    const newAnnotation = await annotationsService.createAnnotation(
      result.data,
    );
    return c.json(newAnnotation, 201);
  } catch (error: any) {
    if (error.message && error.message.includes('not found')) {
      return c.json({ error: 'Not Found', message: error.message }, 404);
    }
    return c.json({ error: 'Bad Request', message: error.message }, 400);
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
