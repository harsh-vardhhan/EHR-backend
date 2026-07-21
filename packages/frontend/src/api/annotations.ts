import { treaty } from '@elysiajs/eden';
import type { App } from '../../../backend/src/app';
import type { Document, Annotation, Relationship, AuditLog } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const client = treaty<App>(API_URL, {
  headers: API_KEY ? { 'x-api-key': API_KEY } : {},
});

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'value' in error) {
    const val = (error as { value: unknown }).value;
    if (val && typeof val === 'object' && 'message' in val) {
      return String((val as { message: unknown }).message);
    }
  }
  return fallback;
}

export const api = {
  getDocuments: async (): Promise<Document[]> => {
    const { data, error } = await client.documents.get();
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch documents'));
    }
    return data;
  },

  getDocument: async (id: string): Promise<Document> => {
    const { data, error } = await client.documents({ id }).get();
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch document'));
    }

    const annotations = (data.annotations || []).map((a) => ({
      ...a,
      id: a.annotationId || a.id,
    }));

    const relationships = (data.relationships || []).map((r) => ({
      ...r,
      id: r.id || r.relationshipId,
      relationshipId: r.relationshipId || r.id || '',
    }));

    return {
      ...data,
      annotations,
      relationships,
    };
  },

  triggerAnalysis: async (documentId: string): Promise<void> => {
    const { error } = await client.documents({ id: documentId }).analyze.post();
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to trigger analysis'));
    }
  },

  getAnnotations: async (documentId: string): Promise<Annotation[]> => {
    const { data, error } = await client.annotations.get({
      query: { documentId },
    });
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch annotations'));
    }

    return data.map((d) => ({ ...d, id: d.annotationId || d.id }));
  },

  createAnnotation: async (
    payload: Omit<Annotation, 'id' | 'createdAt'>,
  ): Promise<Annotation> => {
    const { data, error } = await client.annotations.post({
      ...payload,
      confidence: payload.confidence ?? undefined,
      assertion: payload.assertion ?? undefined,
      conceptCode: payload.conceptCode ?? undefined,
    });
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to create annotation'));
    }

    return { ...data, id: data.annotationId || data.id };
  },

  updateAnnotation: async (
    id: string,
    updates: Partial<Annotation>,
  ): Promise<Annotation> => {
    const { data, error } = await client.annotations({ id }).patch({
      ...updates,
      confidence: updates.confidence ?? undefined,
      assertion: updates.assertion ?? undefined,
      conceptCode: updates.conceptCode ?? undefined,
    });
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to update annotation'));
    }

    return { ...data, id: data.annotationId || data.id };
  },

  deleteAnnotation: async (id: string): Promise<void> => {
    const { error } = await client.annotations({ id }).delete();
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to delete annotation'));
    }
  },

  getRelationships: async (documentId: string): Promise<Relationship[]> => {
    const { data, error } = await client.annotations.relationships.get({
      query: { documentId },
    });
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch relationships'));
    }

    return data.map((d) => ({
      ...d,
      relationshipId: d.relationshipId || d.id || '',
      id: d.id || d.relationshipId,
    }));
  },

  createRelationship: async (
    payload: Omit<Relationship, 'relationshipId' | 'createdAt'>,
  ): Promise<Relationship> => {
    const { data, error } = await client.annotations.relationships.post({
      ...payload,
      confidence: payload.confidence ?? undefined,
    });
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to create relationship'));
    }

    return {
      ...data,
      relationshipId: data.relationshipId || data.id || '',
      id: data.id || data.relationshipId,
    };
  },

  deleteRelationship: async (id: string, documentId: string): Promise<void> => {
    const { error } = await client
      .annotations.relationships({ relationshipId: id })
      .delete(undefined, {
        query: { documentId },
      });
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to delete relationship'));
    }
  },

  searchAnnotations: async (filters: {
    assertion?: string;
    label?: string;
    conceptCode?: string;
  }): Promise<Annotation[]> => {
    const query: {
      assertion?: 'positive' | 'negated' | 'possible';
      label?:
        | 'Clinical Condition'
        | 'Medication Statement'
        | 'Clinical Finding'
        | 'Medical Procedure';
      conceptCode?: string;
    } = {};

    if (filters.assertion && filters.assertion !== 'all') {
      query.assertion = filters.assertion as
        | 'positive'
        | 'negated'
        | 'possible';
    }
    if (filters.label && filters.label !== 'all') {
      query.label = filters.label as
        | 'Clinical Condition'
        | 'Medication Statement'
        | 'Clinical Finding'
        | 'Medical Procedure';
    }
    if (filters.conceptCode && filters.conceptCode.trim() !== '') {
      query.conceptCode = filters.conceptCode;
    }

    const { data, error } = await client.annotations.search.get({ query });
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to search annotations'));
    }

    return data.map((d) => ({ ...d, id: d.annotationId || d.id }));
  },

  getAuditLogs: async (documentId: string): Promise<AuditLog[]> => {
    const { data, error } = await client
      .documents({ id: documentId })
      .audit.get();
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch audit logs'));
    }
    return data;
  },
};
