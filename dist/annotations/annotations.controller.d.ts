import { AnnotationsService } from './annotations.service';
export declare class AnnotationsController {
    private readonly annotationsService;
    constructor(annotationsService: AnnotationsService);
    getAnnotations(documentId: string): import("./annotations.service").Annotation[];
    createAnnotation(body: {
        documentId: string;
        text: string;
        label: 'Condition' | 'Medication' | 'Symptom' | 'Procedure';
        startOffset: number;
        endOffset: number;
        source: 'human' | 'llm';
        status?: 'suggested' | 'accepted' | 'rejected' | 'corrected';
        confidence?: number;
    }): import("./annotations.service").Annotation;
    deleteAnnotation(id: string): {
        success: boolean;
    };
    updateAnnotation(id: string, updates: Partial<{
        label: string;
        status: string;
        text: string;
    }>): import("./annotations.service").Annotation;
}
