import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

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

@Injectable()
export class AnnotationsService {
  private annotations: Annotation[] = [];

  getAnnotationsByDocument(documentId: string): Annotation[] {
    return this.annotations.filter((a) => a.documentId === documentId);
  }

  createAnnotation(data: Omit<Annotation, 'id' | 'createdAt'>): Annotation {
    const newAnnotation: Annotation = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.annotations.push(newAnnotation);
    return newAnnotation;
  }

  updateAnnotation(id: string, updates: Partial<Annotation>): Annotation {
    const index = this.annotations.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new NotFoundException(`Annotation with id ${id} not found`);
    }
    this.annotations[index] = { ...this.annotations[index], ...updates };
    return this.annotations[index];
  }

  deleteAnnotation(id: string): void {
    const index = this.annotations.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new NotFoundException(`Annotation with id ${id} not found`);
    }
    this.annotations.splice(index, 1);
  }
}
