import { randomUUID } from 'crypto';
import { AuditLogEntity } from '../database/entities';
import type { AuditLog } from '../database/schemas';

export class AuditService {
  async getAuditLogs(documentId: string): Promise<AuditLog[]> {
    try {
      const response = await AuditLogEntity.query.primary({ documentId }).go();
      return ((response.data || []) as AuditLog[]).sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    } catch (error) {
      console.error('Error fetching audit logs', error);
      return [];
    }
  }

  async createAuditLog(
    documentId: string,
    actionType: string,
    description: string,
  ): Promise<AuditLog | undefined> {
    try {
      const logId = randomUUID();
      const log: AuditLog = {
        logId,
        documentId,
        actionType,
        description,
        createdAt: new Date().toISOString(),
      };
      await AuditLogEntity.create(log).go();
      return log;
    } catch (error) {
      console.error('Error creating audit log in DynamoDB', error);
    }
  }
}

export const auditService = new AuditService();
