import { Elysia, t } from 'elysia';
import { documentsService } from './documents.service';
import { annotationsService } from '../annotations/annotations.service';

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
    const isNotFound = (error as any).message
      ?.toLowerCase()
      .includes('not found');
    set.status = isNotFound ? 404 : 500;
    return {
      error: isNotFound ? 'Not Found' : 'Internal Server Error',
      message: (error as any).message,
    };
  })
  .get('/', async () => {
    const docs = await documentsService.getDocuments();
    return docs;
  })
  .get(
    '/:id',
    async ({ params: { id } }) => {
      const doc = await documentsService.getDocument(id);
      return doc;
    },
    {
      params: idParamSchema,
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
    },
  )
  .post(
    '/:id/analyze',
    async ({ params: { id } }) => {
      const doc = (await documentsService.getDocument(id)) as any;
      await documentsService.triggerAnalysis(doc.id, doc.s3Key);
      return { success: true, message: 'Analysis queued successfully' };
    },
    {
      params: idParamSchema,
    },
  );
