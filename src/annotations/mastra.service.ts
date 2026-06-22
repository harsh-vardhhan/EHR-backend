import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { AnnotationsService } from './annotations.service';
import { MEDICAL_ENTITIES } from '../constants/labels';

export class MastraService {
  constructor(private annotationsService: AnnotationsService) {}

  analyzeDocumentBackground(documentId: string, text: string) {
    void this.runAnalysis(documentId, text).catch((err) => {
      console.error('[MastraService] Failed to run LLM analysis', err);
    });
  }

  async runAnalysis(documentId: string, text: string) {
    // Wait for 2 seconds to simulate "2-3 seconds" wait time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not set');
      }

      const groq = createGroq({
        apiKey: process.env.GROQ_API_KEY,
      });

      const { object } = await generateObject({
        model: groq('llama-3.3-70b-versatile'),
        abortSignal: AbortSignal.timeout(8000),
        schema: z.object({
          entities: z.array(
            z.object({
              text: z.string(),
              label: z.enum([
                MEDICAL_ENTITIES.CONDITION,
                MEDICAL_ENTITIES.MEDICATION,
                MEDICAL_ENTITIES.FINDING,
                MEDICAL_ENTITIES.PROCEDURE,
              ]),
              confidence: z.number(),
            }),
          ),
        }),
        prompt: buildExtractionPrompt(text),
      });

      const writePromises = object.entities.map(async (entity) => {
        const escapedText = entity.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexPattern = escapedText.replace(/\\s\+|\\n|\s+/g, '\\s+');
        const regex = new RegExp(regexPattern, 'i');
        const match = text.match(regex);

        if (!match || match.index === undefined) {
          console.warn(
            `[MastraService] Entity text not found in document: ${entity.text}`,
          );
          return;
        }

        await this.annotationsService.createAnnotation({
          documentId,
          text: entity.text,
          label: entity.label,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          source: 'llm',
          status: 'suggested',
          confidence: entity.confidence,
        });
      });

      await Promise.all(writePromises);
    } catch (error: any) {
      console.error('[MastraService] Error calling Groq / AI SDK', error);
      throw error;
    }
  }
}

const buildExtractionPrompt = (text: string) => `Extract medical entities from the following text and classify them strictly into one of these professional healthcare labels: ${MEDICAL_ENTITIES.CONDITION}, ${MEDICAL_ENTITIES.MEDICATION}, ${MEDICAL_ENTITIES.FINDING}, or ${MEDICAL_ENTITIES.PROCEDURE}.

Text: "${text}"`;
