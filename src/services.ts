import { DocumentsService } from './documents/documents.service';
import { AnnotationsService } from './annotations/annotations.service';
import { MastraService } from './workflows/mastra.service';

export const annotationsService = new AnnotationsService();
export const documentsService = new DocumentsService();
export const mastraService = new MastraService(annotationsService);
