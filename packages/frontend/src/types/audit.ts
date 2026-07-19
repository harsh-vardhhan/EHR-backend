import { z } from 'zod';

export const AuditLogSchema = z.object({
    logId: z.string(),
    documentId: z.string(),
    actionType: z.string(),
    description: z.string(),
    createdAt: z.string(),
});

export const AuditLogArraySchema = z.array(AuditLogSchema);

export type AuditLog = z.infer<typeof AuditLogSchema>;
