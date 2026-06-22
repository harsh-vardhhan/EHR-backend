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
        const offsets = findEntityOffsets(text, entity.text);

        if (!offsets) {
          console.warn(
            `[MastraService] Entity text not found in document: ${entity.text}`,
          );
          return;
        }

        await this.annotationsService.createAnnotation({
          documentId,
          text: entity.text,
          label: entity.label,
          startOffset: offsets.startOffset,
          endOffset: offsets.endOffset,
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

/**
 * Finds the character start and end offsets of a text match within a document,
 * ignoring casing and treating dynamic whitespace/newlines as simple spaces.
 */
function findEntityOffsets(
  documentText: string,
  entityText: string,
): { startOffset: number; endOffset: number } | null {
  const escapedText = entityText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escapedText.replace(/\\s\+|\\n|\s+/g, '\\s+');
  const match = documentText.match(new RegExp(regexPattern, 'i'));

  if (!match || match.index === undefined) {
    return null;
  }

  return {
    startOffset: match.index,
    endOffset: match.index + match[0].length,
  };
}
