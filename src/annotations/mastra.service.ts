import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';
import { AnnotationsService } from './annotations.service';

@Injectable()
export class MastraService {
  private readonly logger = new Logger(MastraService.name);

  constructor(private annotationsService: AnnotationsService) {}

  async analyzeDocumentBackground(documentId: string, text: string) {
    // Fire and forget, run async without awaiting in the caller
    this.runAnalysis(documentId, text).catch(err => {
      this.logger.error('Failed to run LLM analysis', err);
    });
  }

  private async runAnalysis(documentId: string, text: string) {
    this.logger.log(`Starting LLM pre-labelling for document ${documentId}`);

    // Wait for 2 seconds to simulate "2-3 seconds" wait time
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not set, falling back to mock data');
      }

      const { object } = await generateObject({
        model: groq('llama-3.3-70b-versatile'),
        schema: z.object({
          entities: z.array(z.object({
            text: z.string(),
            label: z.enum(['Condition', 'Medication', 'Symptom', 'Procedure']),
            confidence: z.number().min(0).max(100),
            startOffset: z.number(),
            endOffset: z.number(),
          }))
        }),
        prompt: `You are a clinical NLP system. Extract medical entities from the following text and classify them into Condition, Medication, Symptom, or Procedure. Return exact start and end character offsets. Text: "${text}"`,
      });

      this.logger.log(`LLM returned ${object.entities.length} entities`);

      object.entities.forEach(entity => {
        let actualStart = entity.startOffset;
        let actualEnd = entity.endOffset;
        let extractedText = text.substring(actualStart, actualEnd);

        if (extractedText !== entity.text) {
          const index = text.indexOf(entity.text);
          if (index !== -1) {
            actualStart = index;
            actualEnd = index + entity.text.length;
          } else {
            this.logger.warn(`Entity text not found in document: ${entity.text}`);
            return;
          }
        }

        this.annotationsService.createAnnotation({
          documentId,
          text: entity.text,
          label: entity.label,
          startOffset: actualStart,
          endOffset: actualEnd,
          source: 'llm',
          status: 'suggested',
          confidence: entity.confidence,
        });
      });

    } catch (error) {
      this.logger.error('Error calling Groq / AI SDK', error);
      this.fallbackMock(documentId, text);
    }
  }

  private fallbackMock(documentId: string, text: string) {
    const mockEntities = [
      { text: 'chest pain', label: 'Symptom', confidence: 95 },
      { text: 'shortness of breath', label: 'Symptom', confidence: 85 },
      { text: 'hypertension', label: 'Condition', confidence: 98 },
      { text: 'type 2 diabetes mellitus', label: 'Condition', confidence: 99 },
      { text: 'lisinopril', label: 'Medication', confidence: 96 },
      { text: 'metformin', label: 'Medication', confidence: 95 },
      { text: 'aspirin', label: 'Medication', confidence: 97 },
      { text: 'furosemide', label: 'Medication', confidence: 94 },
      { text: 'pulmonary oedema', label: 'Condition', confidence: 75 },
      { text: 'echocardiogram', label: 'Procedure', confidence: 55 },
      { text: 'heart failure', label: 'Condition', confidence: 80 }
    ];

    mockEntities.forEach(ent => {
      const index = text.indexOf(ent.text);
      if (index !== -1) {
        this.annotationsService.createAnnotation({
          documentId,
          text: ent.text,
          label: ent.label as any,
          startOffset: index,
          endOffset: index + ent.text.length,
          source: 'llm',
          status: 'suggested',
          confidence: ent.confidence,
        });
      }
    });
  }
}
