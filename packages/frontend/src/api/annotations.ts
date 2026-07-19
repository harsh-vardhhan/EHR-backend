import { treaty } from '@elysiajs/eden';
import type { App } from '../../../backend/src/app';
import type { Annotation } from '../types/annotation';
import type { Document } from '../types/document';
import type { AuditLog } from '../types/audit';
import { 
  AnnotationSchema, 
  AnnotationArraySchema, 
} from '../types/annotation';
import type { Relationship } from '../types/relationship';
import {
  RelationshipSchema,
  RelationshipArraySchema,
} from '../types/relationship';
import {
  DocumentSchema,
  DocumentArraySchema
} from '../types/document';
import { AuditLogArraySchema } from '../types/audit';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const client = treaty<App>(API_URL, {
  headers: API_KEY ? { 'x-api-key': API_KEY } : {},
});

export const api = {
  getDocuments: async (): Promise<Document[]> => {
    const { data, error } = await client.documents.get();
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to fetch documents');
    }
    return DocumentArraySchema.parse(data);
  },

  getDocument: async (id: string): Promise<Document> => {
    const { data, error } = await client.documents({ id }).get();
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to fetch document');
    }
    
    const rawData = data as any;
    // Normalize embedded annotations and relationships to align database keys with schemas
    const mapped = {
      ...rawData,
      annotations: (rawData.annotations as Array<{ id?: string; annotationId?: string; [key: string]: unknown }> || []).map((a) => ({
        ...a,
        id: a.annotationId || a.id,
      })),
      relationships: (rawData.relationships as Array<{ id?: string; relationshipId?: string; [key: string]: unknown }> || []).map((r) => ({
        ...r,
        relationshipId: r.relationshipId || r.id,
        id: r.id || r.relationshipId,
      })),
    };
    
    return DocumentSchema.parse(mapped);
  },

  triggerAnalysis: async (documentId: string): Promise<void> => {
    const { error } = await client.documents({ id: documentId }).analyze.post();
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to trigger analysis');
    }
  },

  getAnnotations: async (documentId: string): Promise<Annotation[]> => {
    const { data, error } = await client.annotations.get({
      query: { documentId },
    });
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to fetch annotations');
    }
    
    // Handle the mapping of annotationId to id if necessary, then parse
    const mappedData = (data as any as Array<Record<string, unknown>>).map(d => ({ ...d, id: d.annotationId || d.id }));
    return AnnotationArraySchema.parse(mappedData);
  },

  createAnnotation: async (
    payload: Omit<Annotation, 'id' | 'createdAt'>
  ): Promise<Annotation> => {
    const { data, error } = await client.annotations.post({
      ...payload,
      confidence: payload.confidence ?? undefined,
      assertion: payload.assertion ?? undefined,
      conceptCode: payload.conceptCode ?? undefined,
    } as any);
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to create annotation');
    }
    
    const raw = data as Record<string, unknown>;
    const mapped = { ...raw, id: raw.annotationId || raw.id };
    return AnnotationSchema.parse(mapped);
  },

  updateAnnotation: async (
    id: string,
    updates: Partial<Annotation>
  ): Promise<Annotation> => {
    const { data, error } = await client.annotations({ id }).patch({
      ...updates,
      confidence: updates.confidence ?? undefined,
      assertion: updates.assertion ?? undefined,
      conceptCode: updates.conceptCode ?? undefined,
    } as any);
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to update annotation');
    }
    
    const raw = data as Record<string, unknown>;
    const mapped = { ...raw, id: raw.annotationId || raw.id };
    return AnnotationSchema.parse(mapped);
  },

  deleteAnnotation: async (id: string): Promise<void> => {
    const { error } = await client.annotations({ id }).delete();
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to delete annotation');
    }
  },

  getRelationships: async (documentId: string): Promise<Relationship[]> => {
    const { data, error } = await client.annotations.relationships.get({
      query: { documentId },
    });
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to fetch relationships');
    }
    
    const mappedData = (data as any as Array<Record<string, unknown>>).map(d => ({
      ...d,
      relationshipId: d.relationshipId || d.id,
      id: d.id || d.relationshipId,
    }));
    return RelationshipArraySchema.parse(mappedData);
  },

  createRelationship: async (
    payload: Omit<Relationship, 'relationshipId' | 'createdAt'>
  ): Promise<Relationship> => {
    const { data, error } = await client.annotations.relationships.post({
      ...payload,
      confidence: payload.confidence ?? undefined,
    } as any);
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to create relationship');
    }
    
    const raw = data as Record<string, unknown>;
    const mapped = {
      ...raw,
      relationshipId: raw.relationshipId || raw.id,
      id: raw.id || raw.relationshipId,
    };
    return RelationshipSchema.parse(mapped);
  },

  deleteRelationship: async (id: string, documentId: string): Promise<void> => {
    const { error } = await client.annotations.relationships({ relationshipId: id }).delete(undefined, {
      query: { documentId },
    } as any);
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to delete relationship');
    }
  },

  searchAnnotations: async (filters: {
    assertion?: string;
    label?: string;
    conceptCode?: string;
  }): Promise<Annotation[]> => {
    const params: Record<string, string> = {};
    if (filters.assertion && filters.assertion !== 'all') params.assertion = filters.assertion;
    if (filters.label && filters.label !== 'all') params.label = filters.label;
    if (filters.conceptCode && filters.conceptCode.trim() !== '') params.conceptCode = filters.conceptCode;

    const { data, error } = await client.annotations.search.get({
      query: params,
    } as any);
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to search annotations');
    }
    
    const mappedData = (data as any as Array<Record<string, unknown>>).map(d => ({ ...d, id: d.annotationId || d.id }));
    return AnnotationArraySchema.parse(mappedData);
  },

  getAuditLogs: async (documentId: string): Promise<AuditLog[]> => {
    const { data, error } = await client.documents({ id: documentId }).audit.get();
    if (error) {
      throw new Error((error.value as any)?.message || 'Failed to fetch audit logs');
    }
    return AuditLogArraySchema.parse(data);
  },
};
