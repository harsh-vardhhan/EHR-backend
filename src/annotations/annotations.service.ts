import { randomUUID } from 'crypto';
import { MedicalEntityLabel } from '../constants/labels';
import { AnnotationEntity, DocumentEntity } from '../database/entities';

export interface Annotation {
  annotationId: string;
  documentId: string;
  text: string;
  label: MedicalEntityLabel;
  startOffset: number;
  endOffset: number;
  createdAt: string;
  source: 'human' | 'llm';
  status?: 'suggested' | 'accepted' | 'rejected' | 'corrected';
  confidence?: number;
  assertion?: 'positive' | 'negated' | 'possible';
  conceptCode?: string;
}

export class AnnotationsService {
  async getAnnotationsByDocument(documentId: string): Promise<Annotation[]> {
    try {
      const response = await AnnotationEntity.query
        .primary({ documentId })
        .go();
      return (response.data as Annotation[]) || [];
    } catch (error) {
      console.error('Error fetching annotations', error);
      return [];
    }
  }

  async createAnnotation(
    data: Omit<Annotation, 'annotationId' | 'createdAt'>,
  ): Promise<Annotation> {
    // Check if document exists in the single table
    const docRes = await DocumentEntity.get({ id: data.documentId }).go();
    if (!docRes.data) {
      throw new Error(`Document with id ${data.documentId} not found`);
    }

    const annotationId = randomUUID();
    const newAnnotation: Annotation = {
      ...data,
      annotationId,
      createdAt: new Date().toISOString(),
    };

    await AnnotationEntity.create(newAnnotation).go();
    return newAnnotation;
  }

  async createAnnotations(
    documentId: string,
    annotationsData: Omit<Annotation, 'annotationId' | 'createdAt' | 'documentId'>[],
  ): Promise<Annotation[]> {
    if (annotationsData.length === 0) return [];

    const docRes = await DocumentEntity.get({ id: documentId }).go();
    if (!docRes.data) {
      throw new Error(`Document with id ${documentId} not found`);
    }

    const timestamp = new Date().toISOString();
    const newAnnotations: Annotation[] = annotationsData.map((data) => ({
      ...data,
      documentId,
      annotationId: randomUUID(),
      createdAt: timestamp,
    }));

    await AnnotationEntity.put(newAnnotations).go();
    return newAnnotations;
  }

  async updateAnnotation(
    annotationId: string,
    updates: Partial<Annotation>,
  ): Promise<Annotation> {
    // 1. Query the GSI to find the documentId for this annotationId
    const findResponse = await AnnotationEntity.query
      .bySk({ annotationId })
      .go();

    const item = findResponse.data?.[0];
    if (!item) {
      throw new Error(`Annotation with id ${annotationId} not found`);
    }
    const documentId = item.documentId;

    // Remove keys that cannot be modified (like keys used in PK/SK)
    const cleanedUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (
        key !== 'annotationId' &&
        key !== 'documentId' &&
        value !== undefined
      ) {
        cleanedUpdates[key] = value;
      }
    }

    if (Object.keys(cleanedUpdates).length === 0) {
      return item as Annotation;
    }

    try {
      const response = await AnnotationEntity.patch({
        documentId,
        annotationId,
      })
        .set(cleanedUpdates)
        .go({ response: 'all_new' });

      if (!response.data) {
        throw new Error(`Annotation with id ${annotationId} not found`);
      }
      return response.data as Annotation;
    } catch (error) {
      console.error('Error updating annotation', error);
      throw new Error(`Annotation with id ${annotationId} not found`);
    }
  }

  async searchAnnotations(filters: {
    assertion?: 'positive' | 'negated' | 'possible';
    label?: MedicalEntityLabel;
    conceptCode?: string;
  }): Promise<Annotation[]> {
    try {
      let query;
      
      if (filters.assertion && filters.label) {
        query = AnnotationEntity.query.byAssertionLabel({
          assertion: filters.assertion,
          label: filters.label,
        });
      } else if (filters.assertion) {
        query = AnnotationEntity.query.byAssertionLabel({
          assertion: filters.assertion,
        });
      }

      if (query) {
        if (filters.conceptCode) {
          query.where(({ conceptCode }, { eq }) => eq(conceptCode, filters.conceptCode!));
        }
        const response = await query.go();
        return (response.data as Annotation[]) || [];
      }

      // If assertion is not provided but label is, query across all assertion partitions in parallel
      if (filters.label) {
        const assertions: Array<'positive' | 'negated' | 'possible'> = ['positive', 'negated', 'possible'];
        const results = await Promise.all(
          assertions.map(async (assertion) => {
            const q = AnnotationEntity.query.byAssertionLabel({
              assertion,
              label: filters.label,
            });
            if (filters.conceptCode) {
              q.where(({ conceptCode }, { eq }) => eq(conceptCode, filters.conceptCode!));
            }
            const res = await q.go();
            return res.data || [];
          })
        );
        return results.flat() as Annotation[];
      }

      // If only conceptCode is provided, query across all assertion partitions in parallel
      if (filters.conceptCode) {
        const assertions: Array<'positive' | 'negated' | 'possible'> = ['positive', 'negated', 'possible'];
        const results = await Promise.all(
          assertions.map(async (assertion) => {
            const q = AnnotationEntity.query.byAssertionLabel({ assertion });
            q.where(({ conceptCode }, { eq }) => eq(conceptCode, filters.conceptCode!));
            const res = await q.go();
            return res.data || [];
          })
        );
        return results.flat() as Annotation[];
      }

      return [];
    } catch (error) {
      console.error('Error searching annotations', error);
      return [];
    }
  }
}

