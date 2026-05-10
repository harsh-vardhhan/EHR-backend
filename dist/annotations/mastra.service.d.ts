import { AnnotationsService } from './annotations.service';
export declare class MastraService {
    private annotationsService;
    private readonly logger;
    constructor(annotationsService: AnnotationsService);
    analyzeDocumentBackground(documentId: string, text: string): void;
    private runAnalysis;
    private fallbackMock;
}
