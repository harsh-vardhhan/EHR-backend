import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { annotationsService } from '../services';
import { MEDICAL_ENTITIES } from '../constants/labels';
import type { MiddlewareHandler } from 'hono';
import { extractClinicalEntities } from './extractor.client';
import { findEntityOffsets } from './mastra.service';

export const annotationsApp = new Hono();

// Validation middlewares
const validateParam = (
  paramName: string,
  schema: z.ZodSchema,
): MiddlewareHandler => {
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

const validateQuery = (
  paramName: string,
  schema: z.ZodSchema,
): MiddlewareHandler => {
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
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'documentId must only contain alphanumeric characters, dashes, or underscores',
  );

const uuidSchema = z.string().uuid('id must be a valid UUID');

annotationsApp.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();

  const status = err.message?.includes('not found') ? 404 : 400;
  return c.json(
    {
      error: status === 404 ? 'Not Found' : 'Bad Request',
      message: err.message,
    },
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
    status: z
      .enum(['suggested', 'accepted', 'rejected', 'corrected'])
      .optional(),
    confidence: z.number().min(0).max(1).optional(),
    assertion: z.enum(['positive', 'negated', 'possible']).optional(),
    conceptCode: z.string().optional(),
  })
  .refine((data) => data.startOffset <= data.endOffset, {
    message: 'startOffset must be less than or equal to endOffset',
    path: ['startOffset'],
  });

const searchQuerySchema = z.object({
  assertion: z.enum(['positive', 'negated', 'possible']).optional(),
  label: z
    .enum([
      MEDICAL_ENTITIES.CONDITION,
      MEDICAL_ENTITIES.MEDICATION,
      MEDICAL_ENTITIES.FINDING,
      MEDICAL_ENTITIES.PROCEDURE,
    ])
    .optional(),
  conceptCode: z.string().optional(),
});

annotationsApp.get('/search', async (c) => {
  const query = c.req.query();
  const result = searchQuerySchema.safeParse(query);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    return c.json({ error: 'Validation failed', message: errors }, 400);
  }

  const annotations = await annotationsService.searchAnnotations(result.data);
  return c.json(annotations);
});

annotationsApp.get(
  '/',
  validateQuery('documentId', documentIdQuerySchema),
  async (c) => {
    const documentId = c.req.query('documentId') || '';
    const annotations =
      await annotationsService.getAnnotationsByDocument(documentId);
    return c.json(annotations);
  },
);

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

const previewRequestSchema = z.object({
  text: z
    .string()
    .min(10, 'Text must be at least 10 characters')
    .max(3000, 'Text must be 3000 characters or less'),
});

annotationsApp.post('/preview', async (c) => {
  const body = await c.req.json();
  const result = previewRequestSchema.safeParse(body);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    return c.json({ error: 'Validation failed', message: errors }, 400);
  }

  const { text } = result.data;

  try {
    const entities = await extractClinicalEntities(text);

    const annotations = entities.map((entity, index) => {
      const offsets = findEntityOffsets(text, entity.text);
      return {
        annotationId: `temp-${index}-${Date.now()}`,
        documentId: 'preview',
        text: entity.text,
        label: entity.label,
        startOffset: offsets?.startOffset ?? 0,
        endOffset: offsets?.endOffset ?? 0,
        source: 'llm' as const,
        status: 'suggested' as const,
        confidence: entity.confidence,
        assertion: entity.assertion,
        conceptCode: entity.conceptCode,
        createdAt: new Date().toISOString(),
      };
    });

    return c.json(annotations);
  } catch (error: any) {
    console.error('Failed to run preview analysis', error);
    return c.json(
      { error: 'Failed to run preview analysis', message: error.message },
      500,
    );
  }
});
