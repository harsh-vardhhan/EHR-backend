import { Elysia, t } from 'elysia';
import { annotationsService } from './annotations.service';
import { MEDICAL_ENTITIES } from '../constants/labels';

const documentIdQuerySchema = t.Object({
  documentId: t.String({
    minLength: 1,
    maxLength: 100,
    pattern: '^[a-zA-Z0-9_-]+$',
    error:
      'documentId must only contain alphanumeric characters, dashes, or underscores',
  }),
});

const uuidParamSchema = t.Object({
  id: t.String({
    format: 'uuid',
    error: 'id must be a valid UUID',
  }),
});

const labelSchema = t.Union(
  [
    t.Literal(MEDICAL_ENTITIES.CONDITION),
    t.Literal(MEDICAL_ENTITIES.MEDICATION),
    t.Literal(MEDICAL_ENTITIES.FINDING),
    t.Literal(MEDICAL_ENTITIES.PROCEDURE),
  ],
  {
    error: 'Invalid label type',
  },
);

const createAnnotationSchema = t.Object({
  documentId: t.String({ minLength: 1, error: 'documentId is required' }),
  text: t.String({
    minLength: 1,
    maxLength: 500,
    error: 'text must be 500 characters or less',
  }),
  label: labelSchema,
  startOffset: t.Numeric({
    minimum: 0,
    error: 'startOffset must be a non-negative integer',
  }),
  endOffset: t.Numeric({
    minimum: 0,
    error: 'endOffset must be a non-negative integer',
  }),
  source: t.Union([t.Literal('human'), t.Literal('llm')], {
    error: 'source must be either "human" or "llm"',
  }),
  status: t.Optional(
    t.Union([
      t.Literal('suggested'),
      t.Literal('accepted'),
      t.Literal('rejected'),
      t.Literal('corrected'),
    ]),
  ),
  confidence: t.Optional(t.Numeric({ minimum: 0, maximum: 1 })),
  assertion: t.Optional(
    t.Union([
      t.Literal('positive'),
      t.Literal('negated'),
      t.Literal('possible'),
    ]),
  ),
  conceptCode: t.Optional(t.String()),
});

const updateAnnotationSchema = t.Partial(createAnnotationSchema);

const searchQuerySchema = t.Object({
  assertion: t.Optional(
    t.Union([
      t.Literal('positive'),
      t.Literal('negated'),
      t.Literal('possible'),
    ]),
  ),
  label: t.Optional(labelSchema),
  conceptCode: t.Optional(t.String()),
});

const createRelationshipSchema = t.Object({
  documentId: t.String({ minLength: 1, error: 'documentId is required' }),
  sourceAnnotationId: t.String({
    format: 'uuid',
    error: 'sourceAnnotationId must be a valid UUID',
  }),
  targetAnnotationId: t.String({
    format: 'uuid',
    error: 'targetAnnotationId must be a valid UUID',
  }),
  relationType: t.String({ minLength: 1, error: 'relationType is required' }),
  confidence: t.Optional(t.Numeric({ minimum: 0, maximum: 1 })),
});

import { AnnotationSchema, RelationshipSchema } from '../database/schemas';

export const annotationsApp = new Elysia({ prefix: '/annotations' })
  .onError(({ error, set }) => {
    const isNotFound = (error as any).message
      ?.toLowerCase()
      .includes('not found');
    set.status = isNotFound ? 404 : 400;
    return {
      error: isNotFound ? 'Not Found' : 'Bad Request',
      message: (error as any).message,
    };
  })
  .get(
    '/search',
    async ({ query }) => {
      const annotations = await annotationsService.searchAnnotations(query);
      return annotations as any;
    },
    {
      query: searchQuerySchema,
      response: t.Array(AnnotationSchema),
    },
  )
  .get(
    '/',
    async ({ query: { documentId } }) => {
      const annotations =
        await annotationsService.getAnnotationsByDocument(documentId);
      return annotations as any;
    },
    {
      query: documentIdQuerySchema,
      response: t.Array(AnnotationSchema),
    },
  )
  .post(
    '/',
    async ({ body, set }) => {
      if (body.startOffset > body.endOffset) {
        set.status = 400;
        return {
          error: 'Validation failed',
          message: 'startOffset must be less than or equal to endOffset',
        } as any;
      }
      const newAnnotation = await annotationsService.createAnnotation(body);
      set.status = 201;
      return newAnnotation as any;
    },
    {
      body: createAnnotationSchema,
      response: {
        201: AnnotationSchema,
        400: t.Object({ error: t.String(), message: t.String() }),
      },
    },
  )
  .patch(
    '/:id',
    async ({ params: { id }, body, set }) => {
      if (
        body.startOffset !== undefined &&
        body.endOffset !== undefined &&
        body.startOffset > body.endOffset
      ) {
        set.status = 400;
        return {
          error: 'Validation failed',
          message: 'startOffset must be less than or equal to endOffset',
        } as any;
      }
      const updatedAnnotation = await annotationsService.updateAnnotation(
        id,
        body,
      );
      return updatedAnnotation as any;
    },
    {
      params: uuidParamSchema,
      body: updateAnnotationSchema,
      response: {
        200: AnnotationSchema,
        400: t.Object({ error: t.String(), message: t.String() }),
      },
    },
  )
  .delete(
    '/:id',
    async ({ params: { id } }) => {
      await annotationsService.deleteAnnotation(id);
      return { success: true } as any;
    },
    {
      params: uuidParamSchema,
      response: t.Object({ success: t.Boolean() }),
    },
  )
  .get(
    '/relationships',
    async ({ query: { documentId } }) => {
      const relationships =
        await annotationsService.getRelationshipsByDocument(documentId);
      return relationships as any;
    },
    {
      query: documentIdQuerySchema,
      response: t.Array(RelationshipSchema),
    },
  )
  .post(
    '/relationships',
    async ({ body }) => {
      const newRel = await annotationsService.createRelationship(body);
      return newRel as any;
    },
    {
      body: createRelationshipSchema,
      response: RelationshipSchema,
    },
  )
  .delete(
    '/relationships/:relationshipId',
    async ({ params: { relationshipId }, query: { documentId }, set }) => {
      if (!documentId) {
        set.status = 400;
        return {
          error: 'Bad Request',
          message: 'documentId query parameter is required',
        } as any;
      }
      await annotationsService.deleteRelationship(documentId, relationshipId);
      return { success: true } as any;
    },
    {
      params: t.Object({
        relationshipId: t.String({
          format: 'uuid',
          error: 'relationshipId must be a valid UUID',
        }),
      }),
      query: t.Object({
        documentId: t.String({ minLength: 1 }),
      }),
      response: {
        200: t.Object({ success: t.Boolean() }),
        400: t.Object({ error: t.String(), message: t.String() }),
      },
    },
  );
