import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { annotationsService } from '../services';
import { MEDICAL_ENTITIES } from '../constants/labels';
import type { MiddlewareHandler } from 'hono';

export const annotationsApp = new Hono();

// Validation middlewares
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

const validateQuery = (paramName: string, schema: z.ZodSchema): MiddlewareHandler => {
  return async (c, next) => {
    const value = c.req.query(paramName);
    const result = schema.safeParse(value);
    if (!result.success) {
      return c.json(
        {
          error: 'Bad Request',
          message: `Invalid query parameter: ${paramName}`,
          details: result.error.errors.map((err) => err.message),
        },
        400,
      );
    }
    await next();
  };
};

const documentIdQuerySchema = z
  .string()
  .min(1, 'documentId is required')
  .max(100, 'documentId is too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'documentId must only contain alphanumeric characters, dashes, or underscores');

const uuidSchema = z.string().uuid('id must be a valid UUID');

annotationsApp.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();

  const status = err.message?.includes('not found') ? 404 : 400;
  return c.json(
    { error: status === 404 ? 'Not Found' : 'Bad Request', message: err.message },
    status,
  );
});

const createAnnotationSchema = z
  .object({
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
  })
  .refine((data) => data.startOffset <= data.endOffset, {
    message: 'startOffset must be less than or equal to endOffset',
    path: ['startOffset'],
  });

annotationsApp.get('/', validateQuery('documentId', documentIdQuerySchema), async (c) => {
  const documentId = c.req.query('documentId') || '';
  const annotations = await annotationsService.getAnnotationsByDocument(documentId);
  return c.json(annotations);
});

annotationsApp.post('/', async (c) => {
  const body = await c.req.json();
  const result = createAnnotationSchema.safeParse(body);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    return c.json({ error: 'Validation failed', message: errors }, 400);
  }

  const newAnnotation = await annotationsService.createAnnotation(result.data);
  return c.json(newAnnotation, 201);
});

annotationsApp.patch('/:id', validateParam('id', uuidSchema), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const updatedAnnotation = await annotationsService.updateAnnotation(id, body);
  return c.json(updatedAnnotation);
});
