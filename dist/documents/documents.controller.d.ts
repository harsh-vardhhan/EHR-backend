import { DocumentsService } from './documents.service';
import { MastraService } from '../annotations/mastra.service';
export declare class DocumentsController {
    private readonly documentsService;
    private readonly mastraService;
    constructor(documentsService: DocumentsService, mastraService: MastraService);
    getDocument(id: string): {
        id: string;
        text: string;
    };
    analyzeDocument(id: string): {
        success: boolean;
        message: string;
    };
}
