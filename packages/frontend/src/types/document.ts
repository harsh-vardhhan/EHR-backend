import { z } from 'zod';
import { DOCUMENT_STATUS } from '../constants/status';
import { AnnotationSchema } from './annotation';
import { RelationshipSchema } from './relationship';

export const DocumentSchema = z.object({
    id: z.string(),
    text: z.string().optional(),
    title: z.string().optional(),
    status: z.enum(Object.values(DOCUMENT_STATUS) as [string, ...string[]]).optional(),
    category: z.string().optional(),
    createdAt: z.string().optional(),
    annotations: z.array(AnnotationSchema).optional(),
    relationships: z.array(RelationshipSchema).optional(),
});

export const DocumentArraySchema = z.array(DocumentSchema);

// Type Inference
export type Document = z.infer<typeof DocumentSchema>;
export type DocumentStatus = z.infer<typeof DocumentSchema.shape.status>;
