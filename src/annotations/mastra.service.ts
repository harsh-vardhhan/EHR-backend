import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { AnnotationsService } from './annotations.service';
import { MEDICAL_ENTITIES } from '../constants/labels';

export class MastraService {
  private readonly logger = {
    log: (msg: string) => console.log(`[MastraService] ${msg}`),
    warn: (msg: string) => console.warn(`[MastraService] ${msg}`),
    error: (msg: string, err?: any) =>
      console.error(`[MastraService] ${msg}`, err || ''),
  };

  constructor(private annotationsService: AnnotationsService) {}

  analyzeDocumentBackground(documentId: string, text: string) {
    // Fire and forget, run async without awaiting in the caller
    void this.runAnalysis(documentId, text).catch((err) => {
      this.logger.error('Failed to run LLM analysis', err);
    });
  }

  /**
   * The core clinical extraction logic.
   * Exposed as public for use by the background SQS worker.
   */
  async runAnalysis(documentId: string, text: string) {
    this.logger.log(`Starting LLM pre-labelling for document ${documentId}`);

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
              startOffset: z.number(),
              endOffset: z.number(),
            }),
          ),
        }),
        prompt: `Extract medical entities from the following text and classify them strictly into one of these professional healthcare labels: ${MEDICAL_ENTITIES.CONDITION}, ${MEDICAL_ENTITIES.MEDICATION}, ${MEDICAL_ENTITIES.FINDING}, or ${MEDICAL_ENTITIES.PROCEDURE}.

Note: Do not calculate exact character offsets. Always set startOffset and endOffset to 0 for every entity. Our backend will handle the exact offset calculation.

Text: "${text}"`,
      });

      this.logger.log(`=========================================`);
      this.logger.log(`✅ SUCCESS: LLM API responded successfully!`);
      this.logger.log(`LLM returned ${object.entities.length} entities`);
      this.logger.log(`=========================================`);

      const writePromises = object.entities.map(async (entity) => {
        let actualStart = entity.startOffset;
        let actualEnd = entity.endOffset;
        const extractedText = text.substring(actualStart, actualEnd);

        if (extractedText !== entity.text) {
          // Escape special regex characters, then replace spaces with \s+ to match across newlines
          const escapedText = entity.text.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
          );
          const regexPattern = escapedText.replace(/\\s\+|\\n|\s+/g, '\\s+');
          const regex = new RegExp(regexPattern, 'i');
          const match = text.match(regex);

          if (match && match.index !== undefined) {
            actualStart = match.index;
            actualEnd = match.index + match[0].length;
          } else {
            this.logger.warn(
              `Entity text not found in document: ${entity.text}`,
            );
            return;
          }
        }

        await this.annotationsService.createAnnotation({
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

      await Promise.all(writePromises);
    } catch (error: any) {
      this.logger.error('Error calling Groq / AI SDK', error);
      throw error;
    }
  }
}
