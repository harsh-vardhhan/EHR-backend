import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AnnotationsService } from './annotations.service';
import { PiiScrubberService } from './pii-scrubber.service';
import { extractClinicalEntities } from './extractor.client';
import { OmopHubClient } from './omophub.client';
import { Annotation } from './annotations.service';
import { Relationship } from './annotations.service';

export function createCheckDuplicateStep(
  annotationsService: AnnotationsService,
) {
  return createStep({
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
        await annotationsService.getAnnotationsByDocument(documentId);
      const isDuplicate = !!(existing && existing.length > 0);

      if (isDuplicate) {
        console.log(
          `[MastraService:check-duplicate] Document ${documentId} already has annotations. Skipping.`,
        );
      }
      return { isDuplicate };
    },
  });
}

export function createScrubPiiStep(piiScrubber: PiiScrubberService) {
  return createStep({
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

      const { scrubbedText, detections } = await piiScrubber.scrubTextMl(
        initData.text,
      );
      return { scrubbedText, detections };
    },
  });
}

export function createSaveScrubbedTextStep(s3Client: S3Client) {
  return createStep({
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

      await s3Client.send(
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
}

export function createExtractionStep() {
  return createStep({
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
}

export function createResolveAndSaveStep(
  annotationsService: AnnotationsService,
  omophubClient: OmopHubClient,
) {
  return createStep({
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
      const resolvedMap = await omophubClient.resolveBulkConcepts(queries);

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
        savedAnnotations = await annotationsService.createAnnotations(
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
        await annotationsService.createRelationships(
          documentId,
          relationshipsToCreate,
        );
      }

      return { success: true, count: savedAnnotations.length };
    },
  });
}
