import { t, type Static } from 'elysia';

export const LabelSchema = t.Union([
  t.Literal('Clinical Condition'),
  t.Literal('Medication Statement'),
  t.Literal('Clinical Finding'),
  t.Literal('Medical Procedure'),
]);

export const AnnotationSchema = t.Object({
  id: t.String(),
  documentId: t.String(),
  text: t.String(),
  label: LabelSchema,
  startOffset: t.Numeric(),
  endOffset: t.Numeric(),
  source: t.Union([t.Literal('human'), t.Literal('llm')]),
  status: t.Optional(
    t.Union([
      t.Literal('suggested'),
      t.Literal('accepted'),
      t.Literal('rejected'),
      t.Literal('corrected'),
    ]),
  ),
  confidence: t.Optional(t.Numeric()),
  assertion: t.Optional(
    t.Union([
      t.Literal('positive'),
      t.Literal('negated'),
      t.Literal('possible'),
    ]),
  ),
  conceptCode: t.Optional(t.String()),
  createdAt: t.Optional(t.String()),
});

export const RelationshipSchema = t.Object({
  relationshipId: t.String(),
  id: t.Optional(t.String()),
  documentId: t.String(),
  sourceAnnotationId: t.String(),
  targetAnnotationId: t.String(),
  relationType: t.String(),
  confidence: t.Optional(t.Numeric()),
  createdAt: t.Optional(t.String()),
});

export const DocumentSchema = t.Object({
  id: t.String(),
  text: t.Optional(t.String()),
  title: t.Optional(t.String()),
  status: t.Optional(
    t.Union([
      t.Literal('ready_for_review'),
      t.Literal('in_progress'),
      t.Literal('reviewed'),
    ]),
  ),
  category: t.Optional(t.String()),
  createdAt: t.Optional(t.String()),
  annotations: t.Optional(t.Array(AnnotationSchema)),
  relationships: t.Optional(t.Array(RelationshipSchema)),
});

export const AuditLogSchema = t.Object({
  logId: t.String(),
  documentId: t.String(),
  actionType: t.String(),
  description: t.String(),
  createdAt: t.String(),
});

// TypeScript type inference
export type Document = Static<typeof DocumentSchema>;
export type Annotation = Static<typeof AnnotationSchema>;
export type Relationship = Static<typeof RelationshipSchema>;
export type AuditLog = Static<typeof AuditLogSchema>;
export type Label = Static<typeof LabelSchema>;
