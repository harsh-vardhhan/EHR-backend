import { z } from 'zod';
import { AnnotationSchema } from './annotation';
import { RelationshipSchema } from './relationship';

export const DocumentSchema = z.object({
    id: z.string(),
    text: z.string().optional(),
    title: z.string().optional(),
    status: z.enum(['ready_for_review', 'in_progress', 'reviewed']).optional(),
    category: z.string().optional(),
    createdAt: z.union([z.string(), z.date()]).transform((val) => val instanceof Date ? val.toISOString() : val).optional(),
    annotations: z.array(AnnotationSchema).optional(),
    relationships: z.array(RelationshipSchema).optional(),
});

export const DocumentArraySchema = z.array(DocumentSchema);

// Type Inference
export type Document = z.infer<typeof DocumentSchema>;
export type DocumentStatus = z.infer<typeof DocumentSchema.shape.status>;
