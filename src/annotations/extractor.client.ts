import { generateText, Output } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { MEDICAL_ENTITIES, MedicalEntityLabel } from '../constants/labels';

export interface ExtractedEntity {
  text: string;
  label: MedicalEntityLabel;
  confidence: number;
  assertion: 'positive' | 'negated' | 'possible';
  conceptCode: string;
}

export async function extractClinicalEntities(
  text: string,
): Promise<ExtractedEntity[]> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const attempts = 1;

  while (attempts > 0) {
    try {
      const { output } = await generateText({
        model: groq('openai/gpt-oss-20b'),
        abortSignal: AbortSignal.timeout(30000),
        output: Output.object({
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
                assertion: z
                  .enum(['positive', 'negated', 'possible'])
                  .describe(
                    "Determines the assertion status of the entity: 'negated' if the text denies the condition/finding (e.g. 'no history of chest pain'), 'possible' if it is uncertain or hypothetical (e.g. 'rule out pneumonia', 'suspect fracture'), or 'positive' if it is present and confirmed.",
                  ),
                conceptCode: z
                  .string()
                  .describe(
                    'The standard medical ontology code for the entity. Provide an ICD-10-CM code for Conditions, an RxNorm CUI code for Medications, or a SNOMED-CT code for Clinical Findings and Medical Procedures.',
                  ),
              }),
            ),
          }),
        }),
        prompt: buildExtractionPrompt(text),
      });

      return output.entities;
    } catch (err: any) {
      console.error(
        `[extractClinicalEntities] LLM extraction failed. Error: ${err.message || err}`,
      );
      throw err;
    }
  }

  throw new Error('Failed to extract clinical entities');
}

const buildExtractionPrompt = (
  text: string,
) => `Extract clinical entities from the patient text and classify them strictly into: ${MEDICAL_ENTITIES.CONDITION}, ${MEDICAL_ENTITIES.MEDICATION}, ${MEDICAL_ENTITIES.FINDING}, or ${MEDICAL_ENTITIES.PROCEDURE}.

For each entity, determine:
1. The assertion status: 'negated' if the finding/condition is mentioned as absent/ruled out/denied, 'possible' if it is a suspected/hypothetical diagnosis, or 'positive' if it is confirmed active.
2. A standard medical concept code: Use ICD-10-CM for Conditions (e.g., 'E11.9'), RxNorm CUI for Medications (e.g., '6809'), or SNOMED-CT for Findings and Procedures.

Text: "${text}"`;
