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

// Helper to safely parse JSON response data even if returned as a string wrapper
function safeJsonParse<T>(data: unknown): T {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as T;
    }
  }
  return data as T;
}

export const api = {
  getDocuments: async (): Promise<Document[]> => {
    const response = await client.documents.get();
    console.log('getDocuments full response object:', response);
    
    const { data, error } = response;
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to fetch documents');
    }
    
    console.log('getDocuments raw data:', data);
    const parsedData = safeJsonParse<unknown>(data);
    console.log('getDocuments parsedData:', parsedData);
    
    const result = DocumentArraySchema.safeParse(parsedData);
    if (!result.success) {
      console.error('getDocuments Zod validation failed details JSON:', JSON.stringify(result.error.issues, null, 2));
      throw new Error(`Documents parse failed: ${result.error.message}`);
    }
    return result.data;
  },

  getDocument: async (id: string): Promise<Document> => {
    const { data, error } = await client.documents({ id }).get();
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to fetch document');
    }
    
    const parsedData = safeJsonParse<Record<string, unknown>>(data);
    // Normalize embedded annotations and relationships to align database keys with schemas
    const mapped = {
      ...parsedData,
      annotations: ((parsedData.annotations as Array<{ id?: string; annotationId?: string; [key: string]: unknown }>) || []).map((a) => ({
        ...a,
        id: a.annotationId || a.id,
      })),
      relationships: ((parsedData.relationships as Array<{ id?: string; relationshipId?: string; [key: string]: unknown }>) || []).map((r) => ({
        ...r,
        relationshipId: r.relationshipId || r.id,
        id: r.id || r.relationshipId,
      })),
    };
    
    const result = DocumentSchema.safeParse(mapped);
    if (!result.success) {
      console.error('getDocument Zod validation failed details JSON:', JSON.stringify(result.error.issues, null, 2));
      throw new Error(`Document parse failed: ${result.error.message}`);
    }
    return result.data;
  },

  triggerAnalysis: async (documentId: string): Promise<void> => {
    const { error } = await client.documents({ id: documentId }).analyze.post();
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to trigger analysis');
    }
  },

  getAnnotations: async (documentId: string): Promise<Annotation[]> => {
    const { data, error } = await client.annotations.get({
      query: { documentId },
    });
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to fetch annotations');
    }
    
    const parsedData = safeJsonParse<Array<Record<string, unknown>>>(data);
    // Handle the mapping of annotationId to id if necessary, then parse
    const mappedData = parsedData.map(d => ({ ...d, id: d.annotationId || d.id }));
    const result = AnnotationArraySchema.safeParse(mappedData);
    if (!result.success) {
      console.error('getAnnotations Zod validation failed details JSON:', JSON.stringify(result.error.issues, null, 2));
      throw new Error(`Annotations parse failed: ${result.error.message}`);
    }
    return result.data;
  },

  createAnnotation: async (
    payload: Omit<Annotation, 'id' | 'createdAt'>
  ): Promise<Annotation> => {
    const { data, error } = await client.annotations.post({
      ...payload,
      confidence: payload.confidence ?? undefined,
      assertion: payload.assertion ?? undefined,
      conceptCode: payload.conceptCode ?? undefined,
    } as unknown as Parameters<typeof client.annotations.post>[0]);
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to create annotation');
    }
    
    const parsedData = safeJsonParse<Record<string, unknown>>(data);
    const mapped = { ...parsedData, id: parsedData.annotationId || parsedData.id };
    const result = AnnotationSchema.safeParse(mapped);
    if (!result.success) {
      console.error('createAnnotation Zod validation failed details JSON:', JSON.stringify(result.error.issues, null, 2));
      throw new Error(`Create annotation parse failed: ${result.error.message}`);
    }
    return result.data;
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
    } as unknown as Parameters<ReturnType<typeof client.annotations>['patch']>[0]);
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to update annotation');
    }
    
    const parsedData = safeJsonParse<Record<string, unknown>>(data);
    const mapped = { ...parsedData, id: parsedData.annotationId || parsedData.id };
    const result = AnnotationSchema.safeParse(mapped);
    if (!result.success) {
      console.error('updateAnnotation Zod validation failed details JSON:', JSON.stringify(result.error.issues, null, 2));
      throw new Error(`Update annotation parse failed: ${result.error.message}`);
    }
    return result.data;
  },

  deleteAnnotation: async (id: string): Promise<void> => {
    const { error } = await client.annotations({ id }).delete();
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to delete annotation');
    }
  },

  getRelationships: async (documentId: string): Promise<Relationship[]> => {
    const { data, error } = await client.annotations.relationships.get({
      query: { documentId },
    });
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to fetch relationships');
    }
    
    const parsedData = safeJsonParse<Array<Record<string, unknown>>>(data);
    const mappedData = parsedData.map(d => ({
      ...d,
      relationshipId: d.relationshipId || d.id,
      id: d.id || d.relationshipId,
    }));
    const result = RelationshipArraySchema.safeParse(mappedData);
    if (!result.success) {
      console.error('getRelationships Zod validation failed details JSON:', JSON.stringify(result.error.issues, null, 2));
      throw new Error(`Relationships parse failed: ${result.error.message}`);
    }
    return result.data;
  },

  createRelationship: async (
    payload: Omit<Relationship, 'relationshipId' | 'createdAt'>
  ): Promise<Relationship> => {
    const { data, error } = await client.annotations.relationships.post({
      ...payload,
      confidence: payload.confidence ?? undefined,
    } as unknown as Parameters<typeof client.annotations.relationships.post>[0]);
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to create relationship');
    }
    
    const parsedData = safeJsonParse<Record<string, unknown>>(data);
    const mapped = {
      ...parsedData,
      relationshipId: parsedData.relationshipId || parsedData.id,
      id: parsedData.id || parsedData.relationshipId,
    };
    const result = RelationshipSchema.safeParse(mapped);
    if (!result.success) {
      console.error('createRelationship Zod validation failed details JSON:', JSON.stringify(result.error.issues, null, 2));
      throw new Error(`Create relationship parse failed: ${result.error.message}`);
    }
    return result.data;
  },

  deleteRelationship: async (id: string, documentId: string): Promise<void> => {
    const { error } = await client.annotations.relationships({ relationshipId: id }).delete(undefined, {
      query: { documentId },
    });
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to delete relationship');
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
      query: params as unknown as NonNullable<Parameters<typeof client.annotations.search.get>[0]>['query'],
    });
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to search annotations');
    }
    
    const parsedData = safeJsonParse<Array<Record<string, unknown>>>(data);
    const mappedData = parsedData.map(d => ({ ...d, id: d.annotationId || d.id }));
    const result = AnnotationArraySchema.safeParse(mappedData);
    if (!result.success) {
      console.error('searchAnnotations Zod validation failed details JSON:', JSON.stringify(result.error.issues, null, 2));
      throw new Error(`Search annotations parse failed: ${result.error.message}`);
    }
    return result.data;
  },

  getAuditLogs: async (documentId: string): Promise<AuditLog[]> => {
    const { data, error } = await client.documents({ id: documentId }).audit.get();
    if (error) {
      throw new Error((error.value as unknown as { message?: string })?.message || 'Failed to fetch audit logs');
    }
    
    const parsedData = safeJsonParse<unknown>(data);
    const result = AuditLogArraySchema.safeParse(parsedData);
    if (!result.success) {
      console.error('getAuditLogs Zod validation failed details JSON:', JSON.stringify(result.error.issues, null, 2));
      throw new Error(`Audit logs parse failed: ${result.error.message}`);
    }
    return result.data;
  },
};
