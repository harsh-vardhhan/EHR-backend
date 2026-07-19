import { z } from 'zod';

export const LabelSchema = z.enum([
  'Clinical Condition',
  'Medication Statement',
  'Clinical Finding',
  'Medical Procedure'
]);

export const AnnotationSchema = z.object({
    id: z.string(),
    documentId: z.string(),
    text: z.string(),
    label: LabelSchema,
    startOffset: z.number(),
    endOffset: z.number(),
    source: z.enum(['human', 'llm']),
    status: z.enum(['suggested', 'accepted', 'rejected', 'corrected']).optional(),
    confidence: z.number().optional(),
    assertion: z.enum(['positive', 'negated', 'possible']).optional(),
    conceptCode: z.string().optional(),
    createdAt: z.union([z.string(), z.date()]).transform((val) => val instanceof Date ? val.toISOString() : val).optional(),
});

export const AnnotationArraySchema = z.array(AnnotationSchema);

// Type Inference
export type Annotation = z.infer<typeof AnnotationSchema>;
export type Label = z.infer<typeof LabelSchema>;
export type AnnotationStatus = z.infer<typeof AnnotationSchema.shape.status>;
export type AnnotationSource = z.infer<typeof AnnotationSchema.shape.source>;
