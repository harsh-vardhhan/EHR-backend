import { generateText, Output } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { MEDICAL_ENTITIES, MedicalEntityLabel } from '../constants/labels';

export interface ExtractedEntity {
  text: string;
  label: MedicalEntityLabel;
  confidence: number;
}

export async function extractClinicalEntities(text: string): Promise<ExtractedEntity[]> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const { output } = await generateText({
    model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
    abortSignal: AbortSignal.timeout(8000),
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
          }),
        ),
      }),
    }),
    prompt: buildExtractionPrompt(text),
  });

  return output.entities;
}

const buildExtractionPrompt = (text: string) => `Extract medical entities from the following text and classify them strictly into one of these professional healthcare labels: ${MEDICAL_ENTITIES.CONDITION}, ${MEDICAL_ENTITIES.MEDICATION}, ${MEDICAL_ENTITIES.FINDING}, or ${MEDICAL_ENTITIES.PROCEDURE}.

Text: "${text}"`;
