import { z } from 'zod';

export const AuditLogSchema = z.object({
    logId: z.string(),
    documentId: z.string(),
    actionType: z.string(),
    description: z.string(),
    createdAt: z.union([z.string(), z.date()]).transform((val) => val instanceof Date ? val.toISOString() : val),
});

export const AuditLogArraySchema = z.array(AuditLogSchema);

export type AuditLog = z.infer<typeof AuditLogSchema>;
