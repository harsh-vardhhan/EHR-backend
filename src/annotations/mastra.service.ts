import { AnnotationsService, Annotation } from './annotations.service';
import { extractClinicalEntities } from './extractor.client';
import { OmopHubClient } from './omophub.client';

export class MastraService {
  private omophubClient = new OmopHubClient();

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
      // 1. Check if annotations already exist in DynamoDB (Skip if seeded/pre-processed)
      const existing = await this.annotationsService.getAnnotationsByDocument(documentId);
      if (existing && existing.length > 0) {
        console.log(
          `[MastraService] Document ${documentId} already has ${existing.length} annotations in DDB. Skipping analysis.`,
        );
        return;
      }

      // 2. Run LLM Clinical Entity extraction
      const entities = await extractClinicalEntities(text);

      // 3. Resolve standard concept codes in bulk from OMOPHub
      const queries = entities.map((entity) => ({
        text: entity.text,
        label: entity.label,
      }));
      const resolvedMap = await this.omophubClient.resolveBulkConcepts(queries);

      const annotationsToCreate: Omit<
        Annotation,
        'annotationId' | 'createdAt' | 'documentId'
      >[] = [];

      for (const entity of entities) {
        const offsets = findEntityOffsets(text, entity.text);

        if (!offsets) {
          console.warn(
            `[MastraService] Entity text not found in document: ${entity.text}`,
          );
          continue;
        }

        // Map resolved concept code, fallback to LLM-generated code if unmapped
        const resolved = resolvedMap.get(entity.text.toLowerCase());
        const conceptCode = resolved?.conceptCode || entity.conceptCode;

        annotationsToCreate.push({
          text: entity.text,
          label: entity.label,
          startOffset: offsets.startOffset,
          endOffset: offsets.endOffset,
          source: 'llm' as const,
          status: 'suggested' as const,
          confidence: entity.confidence,
          assertion: entity.assertion,
          conceptCode,
        });
      }

      await this.annotationsService.createAnnotations(
        documentId,
        annotationsToCreate,
      );
    } catch (error: any) {
      console.error('[MastraService] Error calling Groq / AI SDK / OMOPHub', error);
      throw error;
    }
  }
}

/**
 * Finds the character start and end offsets of a text match within a document,
 * ignoring casing and treating dynamic whitespace/newlines as simple spaces.
 */
export function findEntityOffsets(
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
