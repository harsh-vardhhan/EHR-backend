import { AnnotationsService } from './annotations.service';
import { extractClinicalEntities } from './extractor.client';

export class MastraService {
  constructor(private annotationsService: AnnotationsService) {}

  analyzeDocumentBackground(documentId: string, text: string) {
    void this.runAnalysis(documentId, text).catch((err) => {
      console.error('[MastraService] Failed to run LLM analysis', err);
    });
  }

  /**
   * The core clinical extraction logic.
   * Exposed as public for use by the background SQS worker.
   */
  async runAnalysis(documentId: string, text: string) {
    // Wait for 2 seconds to simulate "2-3 seconds" wait time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const entities = await extractClinicalEntities(text);

      const writePromises = entities.map(async (entity) => {
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
