import { z } from 'zod';
import { MEDICAL_ENTITIES, type LabelId } from '../constants/labels';
import {
    ANNOTATION_STATUS,
    ANNOTATION_SOURCE
} from '../constants/status';

export const LabelSchema = z.enum(Object.values(MEDICAL_ENTITIES) as [LabelId, ...LabelId[]]);

export const AnnotationSchema = z.object({
    id: z.string(),
    documentId: z.string(),
    text: z.string(),
    label: LabelSchema,
    startOffset: z.number(),
    endOffset: z.number(),
    source: z.enum(Object.values(ANNOTATION_SOURCE) as [string, ...string[]]),
    status: z.enum(Object.values(ANNOTATION_STATUS) as [string, ...string[]]).optional(),
    confidence: z.number().optional(),
    assertion: z.enum(['positive', 'negated', 'possible']).optional(),
    conceptCode: z.string().optional(),
    createdAt: z.string().optional(),
});

export const AnnotationArraySchema = z.array(AnnotationSchema);

// Type Inference
export type Annotation = z.infer<typeof AnnotationSchema>;
export type Label = z.infer<typeof LabelSchema>;
export type AnnotationStatus = z.infer<typeof AnnotationSchema.shape.status>;
export type AnnotationSource = z.infer<typeof AnnotationSchema.shape.source>;
