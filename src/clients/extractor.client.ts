import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import { z } from 'zod';
import { MedicalEntityLabel } from '../constants/labels';

export interface ExtractedEntity {
  text: string;
  label: MedicalEntityLabel;
  confidence: number;
  assertion: 'positive' | 'negated' | 'possible';
  conceptCode: string;
  startOffset: number;
  endOffset: number;
}

export interface ExtractedRelation {
  sourceStart: number;
  sourceEnd: number;
  targetStart: number;
  targetEnd: number;
  relation: string;
  confidence: number;
}

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
  region: process.env.AWS_REGION || 'ap-south-1',
});

function mapMlResponse(parsedData: unknown): ExtractionResult {
  const validated = sagemakerResponseSchema.parse(parsedData);

  const entities: ExtractedEntity[] = validated.entities.map((ent) => ({
    text: ent.text,
    label: ent.label as MedicalEntityLabel,
    confidence: ent.confidence,
    assertion: ent.assertion,
    conceptCode: '',
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
  const localMlUrl = process.env.LOCAL_ML_URL;
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
    } catch (err: any) {
      console.error(
        `[extractClinicalEntities] Local ML server query failed: ${err.message || err}`,
      );
      throw err;
    }
  }

  const endpointName =
    process.env.SAGEMAKER_ENDPOINT_NAME || 'gliner-relex-endpoint';

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
  } catch (err: any) {
    console.error(
      `[extractClinicalEntities] SageMaker extraction failed: ${err.message || err}`,
    );
    throw err;
  }
}
