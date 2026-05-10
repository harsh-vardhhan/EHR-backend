export interface Annotation {
    id: string;
    documentId: string;
    text: string;
    label: 'Condition' | 'Medication' | 'Symptom' | 'Procedure';
    startOffset: number;
    endOffset: number;
    createdAt: string;
    source: 'human' | 'llm';
    status?: 'suggested' | 'accepted' | 'rejected' | 'corrected';
    confidence?: number;
}
export declare class AnnotationsService {
    private annotations;
    getAnnotationsByDocument(documentId: string): Annotation[];
    createAnnotation(data: Omit<Annotation, 'id' | 'createdAt'>): Annotation;
    updateAnnotation(id: string, updates: Partial<Annotation>): Annotation;
    deleteAnnotation(id: string): void;
}
