import { createWorkflow } from '@mastra/core/workflows';
import { Mastra } from '@mastra/core';
import { z } from 'zod';
import { AnnotationsService } from '../annotations/annotations.service';
import { PiiScrubberService } from '../annotations/pii-scrubber.service';
import { S3Client } from '@aws-sdk/client-s3';
import {
  createCheckDuplicateStep,
  createScrubPiiStep,
  createSaveScrubbedTextStep,
  createExtractionStep,
  createResolveAndSaveStep,
} from './mastra.steps';

export class MastraService {
  private mastra: Mastra;

  constructor(
    private annotationsService: AnnotationsService,
    private s3Client = new S3Client({}),
    private piiScrubber = new PiiScrubberService(),
  ) {
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

      if (result.status !== 'success') {
        throw new Error(
          `Workflow execution failed with status: ${result.status}`,
        );
      }

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
    const checkDuplicateStep = createCheckDuplicateStep(
      this.annotationsService,
    );
    const scrubPiiStep = createScrubPiiStep(this.piiScrubber);
    const saveScrubbedTextStep = createSaveScrubbedTextStep(this.s3Client);
    const extractionStep = createExtractionStep();
    const resolveAndSaveStep = createResolveAndSaveStep(
      this.annotationsService,
    );

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
      .parallel([saveScrubbedTextStep, extractionStep])
      .then(resolveAndSaveStep)
      .commit();
  }
}
