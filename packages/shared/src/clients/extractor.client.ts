import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import { z } from 'zod';
import { MEDICAL_ENTITIES, type MedicalEntityLabel } from '../constants/labels';
import { config } from '../config';

export const extractedEntitySchema = z.object({
  text: z.string(),
  label: z.enum(
    Object.values(MEDICAL_ENTITIES) as [
      MedicalEntityLabel,
      ...MedicalEntityLabel[],
    ],
  ),
  confidence: z.number(),
  assertion: z.enum(['positive', 'negated', 'possible']),
  conceptCode: z.string(),
  startOffset: z.number(),
  endOffset: z.number(),
});

export const extractedRelationSchema = z.object({
  sourceStart: z.number(),
  sourceEnd: z.number(),
  targetStart: z.number(),
  targetEnd: z.number(),
  relation: z.string(),
  confidence: z.number(),
});

export type ExtractedEntity = z.infer<typeof extractedEntitySchema>;
export type ExtractedRelation = z.infer<typeof extractedRelationSchema>;

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
}

const sagemakerResponseSchema = z.object({
  entities: z.array(
    z.object({
      text: z.string(),
      label: z.string(),
      start: z.number(),
      end: z.number(),
      confidence: z.number(),
      assertion: z.enum(['positive', 'negated', 'possible']),
      concept_code: z.string().optional(),
    }),
  ),
  relations: z.array(
    z.object({
      source_start: z.number(),
      source_end: z.number(),
      target_start: z.number(),
      target_end: z.number(),
      relation: z.string(),
      confidence: z.number(),
    }),
  ),
});

const client = new SageMakerRuntimeClient({
  region: config.awsRegion,
});

function mapMlResponse(parsedData: unknown): ExtractionResult {
  const validated = sagemakerResponseSchema.parse(parsedData);

  const entities: ExtractedEntity[] = validated.entities.map((ent) => ({
    text: ent.text,
    label: ent.label as MedicalEntityLabel,
    confidence: ent.confidence,
    assertion: ent.assertion,
    conceptCode: ent.concept_code || '',
    startOffset: ent.start,
    endOffset: ent.end,
  }));

  const relations: ExtractedRelation[] = validated.relations.map((rel) => ({
    sourceStart: rel.source_start,
    sourceEnd: rel.source_end,
    targetStart: rel.target_start,
    targetEnd: rel.target_end,
    relation: rel.relation,
    confidence: rel.confidence,
  }));

  return { entities, relations };
}

export async function extractClinicalEntities(
  text: string,
): Promise<ExtractionResult> {
  const localMlUrl = config.localMlUrl;
  if (localMlUrl) {
    try {
      console.log(
        `[extractClinicalEntities] Querying local Python ML server at: "${localMlUrl}"...`,
      );
      const response = await fetch(localMlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(
          `Local ML server responded with status: ${response.status}`,
        );
      }

      const parsedData = await response.json();
      const result = mapMlResponse(parsedData);

      console.log(
        `[extractClinicalEntities] Successfully extracted ${result.entities.length} entities and ${result.relations.length} relations from local Python ML server.`,
      );
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[extractClinicalEntities] Local ML server query failed: ${msg}`,
      );
      throw err;
    }
  }

  const endpointName = config.sagemakerEndpointName;

  try {
    const payload = { text };

    console.log(
      `[extractClinicalEntities] Invoking SageMaker Endpoint: "${endpointName}"...`,
    );

    const command = new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Body: Buffer.from(JSON.stringify(payload)),
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body from SageMaker endpoint');
    }

    const responseText = Buffer.from(response.Body).toString('utf-8');
    const parsedData = JSON.parse(responseText);

    return mapMlResponse(parsedData);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[extractClinicalEntities] SageMaker extraction failed: ${msg}`,
    );
    throw err;
  }
}
