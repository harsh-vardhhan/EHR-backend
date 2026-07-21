import { Elysia, t } from 'elysia';
import { documentsService } from './documents.service';
import { annotationsService } from '../annotations/annotations.service';

import { DocumentSchema, AuditLogSchema } from '../database/schemas';

const idPattern = /^[a-zA-Z0-9_-]+$/;

// Native TypeBox id validation schema
const idParamSchema = t.Object({
  id: t.String({
    minLength: 1,
    maxLength: 100,
    pattern: idPattern.source,
    error:
      'id must only contain alphanumeric characters, dashes, or underscores',
  }),
});

export const documentsApp = new Elysia({ prefix: '/documents' })
  .onError(({ error, set }) => {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'An unexpected error occurred';
    const isNotFound = message.toLowerCase().includes('not found');
    set.status = isNotFound ? 404 : 500;
    return {
      error: isNotFound ? 'Not Found' : 'Internal Server Error',
      message,
    };
  })
  .get(
    '/',
    async () => {
      const docs = await documentsService.getDocuments();
      return docs;
    },
    {
      response: t.Array(DocumentSchema),
    },
  )
  .get(
    '/:id',
    async ({ params: { id } }) => {
      const doc = await documentsService.getDocument(id);
      return doc;
    },
    {
      params: idParamSchema,
      response: DocumentSchema,
    },
  )
  .get(
    '/:id/audit',
    async ({ params: { id } }) => {
      const auditLogs = await annotationsService.getAuditLogs(id);
      return auditLogs;
    },
    {
      params: idParamSchema,
      response: t.Array(AuditLogSchema),
    },
  )
  .post(
    '/:id/analyze',
    async ({ params: { id } }) => {
      const doc = await documentsService.getDocument(id);
      await documentsService.triggerAnalysis(doc.id, doc.s3Key || '');
      return { success: true, message: 'Analysis queued successfully' };
    },
    {
      params: idParamSchema,
      response: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  );
