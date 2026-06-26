import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { AnnotationsService, Annotation } from './annotations.service';
import { extractClinicalEntities } from './extractor.client';
import { OmopHubClient } from './omophub.client';

export class MastraService {
  private omophubClient = new OmopHubClient();
  private workflow;

  constructor(private annotationsService: AnnotationsService) {
    this.workflow = this.initWorkflow();
  }

  analyzeDocumentBackground(documentId: string, text: string) {
    void this.runAnalysis(documentId, text).catch((err) => {
      console.error('[MastraService] Failed to run LLM analysis', err);
    });
  }

  /**
   * Orchestrates clinical note extraction using a Mastra Workflow.
   * Runs the duplicate check, NER extraction, and code resolution steps.
   */
  async runAnalysis(documentId: string, text: string) {
    // Wait for 2 seconds to simulate "2-3 seconds" wait time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      console.log(`[MastraService] Starting clinical analysis workflow for document: ${documentId}`);
      const run = await this.workflow.createRun();
      const result = await run.start({
        inputData: {
          documentId,
          text,
        },
      });

      console.log(
        `[MastraService] Completed analysis workflow for document: ${documentId}. Status: ${result.status}`,
      );

      const saveResult = result.steps['resolve-and-save'];
      if (saveResult) {
        console.log(
          `[MastraService] resolve-and-save step result:`,
          JSON.stringify(saveResult.output),
        );
      }
    } catch (error: any) {
      console.error('[MastraService] Error executing analysis workflow', error);
      throw error;
    }
  }

  /**
   * Initializes the Mastra Workflow with sequential Steps.
   */
  private initWorkflow() {
    // Step 1: Check if annotations already exist in DynamoDB
    const checkDuplicateStep = createStep({
      id: 'check-duplicate',
      inputSchema: z.object({}),
      outputSchema: z.object({
        isDuplicate: z.boolean(),
      }),
      execute: async ({ getInitData }) => {
        const initData = getInitData<{ documentId: string; text: string }>();
        const { documentId } = initData;
        const existing = await this.annotationsService.getAnnotationsByDocument(documentId);
        const isDuplicate = !!(existing && existing.length > 0);

        if (isDuplicate) {
          console.log(
            `[MastraService:check-duplicate] Document ${documentId} already has annotations. Skipping.`,
          );
        }
        return { isDuplicate };
      },
    });

    // Step 2: Run LLM Clinical Entity extraction (if not a duplicate)
    const extractionStep = createStep({
      id: 'extract-entities',
      inputSchema: z.object({}),
      outputSchema: z.object({
        entities: z.array(z.any()),
        skipped: z.boolean(),
      }),
      execute: async ({ getInitData, getStepResult }) => {
        const initData = getInitData<{ documentId: string; text: string }>();
        const checkResult = getStepResult<{ isDuplicate: boolean }>('check-duplicate');

        if (checkResult?.isDuplicate) {
          return { entities: [], skipped: true };
        }

        const entities = await extractClinicalEntities(initData.text);
        return { entities, skipped: false };
      },
    });

    // Step 3: Resolve ontology codes via OMOPHub and save annotations directly to DynamoDB
    const resolveAndSaveStep = createStep({
      id: 'resolve-and-save',
      inputSchema: z.object({}),
      outputSchema: z.object({
        success: z.boolean(),
        count: z.number(),
      }),
      execute: async ({ getInitData, getStepResult }) => {
        const initData = getInitData<{ documentId: string; text: string }>();
        const checkResult = getStepResult<{ isDuplicate: boolean }>('check-duplicate');
        const extractResult = getStepResult<{ entities: any[]; skipped: boolean }>('extract-entities');

        if (
          checkResult?.isDuplicate ||
          extractResult?.skipped ||
          !extractResult?.entities ||
          extractResult.entities.length === 0
        ) {
          return { success: true, count: 0 };
        }

        const { documentId, text } = initData;
        const entities = extractResult.entities;

        // Map resolved concept codes in bulk from OMOPHub
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
              `[MastraService:resolve-and-save] Entity text not found in document: ${entity.text}`,
            );
            continue;
          }

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

        if (annotationsToCreate.length > 0) {
          await this.annotationsService.createAnnotations(
            documentId,
            annotationsToCreate,
          );
        }

        return { success: true, count: annotationsToCreate.length };
      },
    });

    return createWorkflow({
      id: 'clinical-analysis-workflow',
      inputSchema: z.object({
        documentId: z.string(),
        text: z.string(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        count: z.number(),
      }),
    })
      .then(checkDuplicateStep)
      .then(extractionStep)
      .then(resolveAndSaveStep)
      .commit();
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
