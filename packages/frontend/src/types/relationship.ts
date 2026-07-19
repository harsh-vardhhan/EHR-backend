import { z } from 'zod';

export const RelationshipSchema = z.object({
    relationshipId: z.string(),
    id: z.string().optional(),
    documentId: z.string(),
    sourceAnnotationId: z.string(),
    targetAnnotationId: z.string(),
    relationType: z.string(),
    confidence: z.number().optional(),
    createdAt: z.union([z.string(), z.date()]).transform((val) => val instanceof Date ? val.toISOString() : val).optional(),
});

export const RelationshipArraySchema = z.array(RelationshipSchema);

// Type Inference
export type Relationship = z.infer<typeof RelationshipSchema>;
