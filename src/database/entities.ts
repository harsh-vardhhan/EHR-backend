import { Service } from 'electrodb';
import { DocumentEntity } from '../documents/documents.entity';
import {
  AnnotationEntity,
  RelationshipEntity,
  AuditLogEntity,
} from '../annotations/annotations.entity';

export { DocumentEntity, AnnotationEntity, RelationshipEntity, AuditLogEntity };

export const EhrService = new Service({
  document: DocumentEntity,
  annotation: AnnotationEntity,
  relationship: RelationshipEntity,
  auditLog: AuditLogEntity,
});
