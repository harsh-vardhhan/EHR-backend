import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Mastra } from '@mastra/core';
import { z } from 'zod';
import {
  AnnotationsService,
  Annotation,
  Relationship,
} from './annotations.service';
import { extractClinicalEntities } from './extractor.client';
import { OmopHubClient } from './omophub.client';
import { PiiScrubberService } from './pii-scrubber.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export class MastraService {
  private omophubClient = new OmopHubClient();
  private piiScrubber = new PiiScrubberService();
  private s3Client = new S3Client({});
  private mastra: Mastra;

  constructor(private annotationsService: AnnotationsService) {
    const workflow = this.initWorkflow();
    this.mastra = new Mastra({
      workflows: {
        clinicalAnalysis: workflow,
      },
    });
  }

  /**
   * Orchestrates clinical note extraction using a Mastra Workflow.
   * Runs the duplicate check, NER extraction, and code resolution steps.
   */
  async runAnalysis(documentId: string, text: string) {
    try {
      console.log(
        `[MastraService] Starting clinical analysis workflow for document: ${documentId}`,
      );
      const workflow = this.mastra.getWorkflow('clinicalAnalysis');
      const run = await workflow.createRun();
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
      if (saveResult && saveResult.status === 'success') {
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
      execute: async (context) => {
        const initData = context.getInitData<{
          documentId: string;
          text: string;
        }>();
        const { documentId } = initData;
        const existing =
          await this.annotationsService.getAnnotationsByDocument(documentId);
        const isDuplicate = !!(existing && existing.length > 0);

        if (isDuplicate) {
          console.log(
            `[MastraService:check-duplicate] Document ${documentId} already has annotations. Skipping.`,
          );
        }
        return { isDuplicate };
      },
    });

    // Step 2: Run ML-based PII scrubbing
    const scrubPiiStep = createStep({
      id: 'scrub-pii',
      inputSchema: z.object({}),
      outputSchema: z.object({
        scrubbedText: z.string(),
        detections: z.array(z.any()),
      }),
      execute: async (context) => {
        const initData = context.getInitData<{
          documentId: string;
          text: string;
        }>();
        const checkResult = context.getStepResult<{ isDuplicate: boolean }>(
          'check-duplicate',
        );

        if (checkResult?.isDuplicate) {
          return { scrubbedText: initData.text, detections: [] };
        }

        const { scrubbedText, detections } = await this.piiScrubber.scrubTextMl(
          initData.text,
        );
        return { scrubbedText, detections };
      },
    });

    // Step 3: Save scrubbed text to S3 under safe key 'scrubbed/${documentId}.txt'
    const saveScrubbedTextStep = createStep({
      id: 'save-scrubbed-text',
      inputSchema: z.object({}),
      outputSchema: z.object({
        success: z.boolean(),
      }),
      execute: async (context) => {
        const initData = context.getInitData<{
          documentId: string;
        }>();
        const checkResult = context.getStepResult<{ isDuplicate: boolean }>(
          'check-duplicate',
        );

        if (checkResult?.isDuplicate) {
          return { success: true };
        }

        const scrubResult = context.getStepResult<{
          scrubbedText: string;
        }>('scrub-pii');

        if (!scrubResult?.scrubbedText) {
          return { success: false };
        }

        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.DOCUMENTS_BUCKET_NAME,
            Key: `scrubbed/${initData.documentId}.txt`,
            Body: scrubResult.scrubbedText,
            ContentType: 'text/plain',
          }),
        );

        return { success: true };
      },
    });

    // Step 4: Run LLM Clinical Entity extraction on the scrubbed text
    const extractionStep = createStep({
      id: 'extract-entities',
      inputSchema: z.object({}),
      outputSchema: z.object({
        entities: z.array(z.any()),
        relations: z.array(z.any()),
        skipped: z.boolean(),
      }),
      execute: async (context) => {
        const checkResult = context.getStepResult<{ isDuplicate: boolean }>(
          'check-duplicate',
        );
        const scrubResult = context.getStepResult<{
          scrubbedText: string;
        }>('scrub-pii');

        if (checkResult?.isDuplicate || !scrubResult?.scrubbedText) {
          return { entities: [], relations: [], skipped: true };
        }

        const { entities, relations } = await extractClinicalEntities(
          scrubResult.scrubbedText,
        );
        return { entities, relations, skipped: false };
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
      execute: async (context) => {
        const initData = context.getInitData<{
          documentId: string;
          text: string;
        }>();
        const checkResult = context.getStepResult<{ isDuplicate: boolean }>(
          'check-duplicate',
        );
        const extractResult = context.getStepResult<{
          entities: any[];
          relations: any[];
          skipped: boolean;
        }>('extract-entities');

        if (
          checkResult?.isDuplicate ||
          extractResult?.skipped ||
          !extractResult?.entities ||
          extractResult.entities.length === 0
        ) {
          return { success: true, count: 0 };
        }

        const { documentId } = initData;
        const entities = extractResult.entities;
        const relations = extractResult.relations || [];

        // Map resolved concept codes in bulk from OMOPHub
        const queries = entities.map((entity) => ({
          text: entity.text,
          label: entity.label,
        }));
        const resolvedMap =
          await this.omophubClient.resolveBulkConcepts(queries);

        const annotationsToCreate: Omit<
          Annotation,
          'annotationId' | 'createdAt' | 'documentId'
        >[] = [];

        for (const entity of entities) {
          const resolved = resolvedMap.get(entity.text.toLowerCase());
          const conceptCode = resolved?.conceptCode || entity.conceptCode || '';

          annotationsToCreate.push({
            text: entity.text,
            label: entity.label,
            startOffset: entity.startOffset,
            endOffset: entity.endOffset,
            source: 'llm' as const,
            status: 'suggested' as const,
            confidence: entity.confidence,
            assertion: entity.assertion,
            conceptCode,
          });
        }

        let savedAnnotations: Annotation[] = [];
        if (annotationsToCreate.length > 0) {
          savedAnnotations = await this.annotationsService.createAnnotations(
            documentId,
            annotationsToCreate,
          );
        }

        // Bridge extracted relations using character offsets to resolved DB UUID annotationIds
        const relationshipsToCreate: Omit<
          Relationship,
          'relationshipId' | 'createdAt' | 'documentId'
        >[] = [];

        for (const rel of relations) {
          const sourceAnn = savedAnnotations.find(
            (ann) =>
              ann.startOffset === rel.sourceStart &&
              ann.endOffset === rel.sourceEnd,
          );
          const targetAnn = savedAnnotations.find(
            (ann) =>
              ann.startOffset === rel.targetStart &&
              ann.endOffset === rel.targetEnd,
          );

          if (sourceAnn && targetAnn) {
            relationshipsToCreate.push({
              sourceAnnotationId: sourceAnn.annotationId,
              targetAnnotationId: targetAnn.annotationId,
              relationType: rel.relation,
              confidence: rel.confidence,
            });
          }
        }

        if (relationshipsToCreate.length > 0) {
          await this.annotationsService.createRelationships(
            documentId,
            relationshipsToCreate,
          );
        }

        return { success: true, count: savedAnnotations.length };
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
      .then(scrubPiiStep)
      .then(saveScrubbedTextStep)
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
