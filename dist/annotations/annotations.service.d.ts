export interface Annotation {
    id: string;
    documentId: string;
    text: string;
    label: 'Condition' | 'Medication' | 'Symptom' | 'Procedure';
    startOffset: number;
    endOffset: number;
    createdAt: string;
}
export declare class AnnotationsService {
    private annotations;
    getAnnotationsByDocument(documentId: string): Annotation[];
    createAnnotation(data: Omit<Annotation, 'id' | 'createdAt'>): Annotation;
    deleteAnnotation(id: string): void;
}
