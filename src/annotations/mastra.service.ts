/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { AnnotationsService } from './annotations.service';

@Injectable()
export class MastraService {
  private readonly logger = new Logger(MastraService.name);

  constructor(private annotationsService: AnnotationsService) {}

  analyzeDocumentBackground(documentId: string, text: string) {
    // Fire and forget, run async without awaiting in the caller
    void this.runAnalysis(documentId, text).catch((err) => {
      this.logger.error('Failed to run LLM analysis', err);
    });
  }

  private async runAnalysis(documentId: string, text: string) {
    this.logger.log(`Starting LLM pre-labelling for document ${documentId}`);

    // Wait for 2 seconds to simulate "2-3 seconds" wait time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not set, falling back to mock data');
      }

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            max_tokens: 4096,
            messages: [
              {
                role: 'system',
                content: 'You are a clinical NLP system.',
              },
              {
                role: 'user',
                content: `Extract medical entities from the following text and classify them strictly into one of these labels: Condition, Medication, Symptom, or Procedure.

Important: You must output your response as a valid JSON object matching this schema:
{
  "entities": [
    { "text": string, "label": "Condition" | "Medication" | "Symptom" | "Procedure", "confidence": number, "startOffset": number, "endOffset": number }
  ]
}

Note: Do not calculate exact character offsets. Always set startOffset and endOffset to 0 for every entity. Our backend will handle the exact offset calculation.

Example output:
{
  "entities": [
    { "text": "chest pain", "label": "Symptom", "confidence": 95, "startOffset": 0, "endOffset": 0 }
  ]
}

Do not include any markdown formatting, backticks, or conversational text. Return only the JSON object. Do not over-reason. Output the final JSON immediately.

Text: "${text}"`,
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error: ${errorText}`);
      }

      const data = await response.json();
      let generatedText = data.choices[0].message.content || '';

      // Robust JSON extraction to handle markdown or conversational wrappers
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedText = jsonMatch[0];
      }

      let object;
      try {
        object = JSON.parse(generatedText);
      } catch (e) {
        throw new Error(
          `Failed to parse JSON. Raw text was: ${generatedText}. Error: ${e.message}`,
        );
      }

      this.logger.log(`=========================================`);
      this.logger.log(
        `✅ SUCCESS: LLM API (gpt-oss-120b) responded successfully!`,
      );
      this.logger.log(`LLM returned ${object.entities.length} entities`);
      this.logger.log(`=========================================`);

      object.entities.forEach((entity) => {
        let actualStart = entity.startOffset;
        let actualEnd = entity.endOffset;
        const extractedText = text.substring(actualStart, actualEnd);

        if (extractedText !== entity.text) {
          // Escape special regex characters, then replace spaces with \s+ to match across newlines
          const escapedText = entity.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regexPattern = escapedText.replace(/\\s\+|\\n|\s+/g, '\\s+');
          const regex = new RegExp(regexPattern, 'i');
          const match = text.match(regex);

          if (match && match.index !== undefined) {
            actualStart = match.index;
            actualEnd = match.index + match[0].length;
          } else {
            this.logger.warn(
              `Entity text not found in document: ${entity.text}`,
            );
            return;
          }
        }

        this.annotationsService.createAnnotation({
          documentId,
          text: entity.text,
          label: entity.label,
          startOffset: actualStart,
          endOffset: actualEnd,
          source: 'llm',
          status: 'suggested',
          confidence: entity.confidence,
        });
      });
    } catch (error) {
      this.logger.error('Error calling Groq / AI SDK', error);
      this.fallbackMock(documentId, text);
    }
  }

  private fallbackMock(documentId: string, text: string) {
    this.logger.warn(`=========================================`);
    this.logger.warn(`⚠️ FALLBACK ENGAGED: Using hardcoded mock data!`);
    this.logger.warn(`=========================================`);
    const mockEntities = [
      { text: 'chest pain', label: 'Symptom', confidence: 95 },
      { text: 'shortness of breath', label: 'Symptom', confidence: 85 },
      { text: 'hypertension', label: 'Condition', confidence: 98 },
      { text: 'type 2 diabetes mellitus', label: 'Condition', confidence: 99 },
      { text: 'lisinopril', label: 'Medication', confidence: 96 },
      { text: 'metformin', label: 'Medication', confidence: 95 },
      { text: 'aspirin', label: 'Medication', confidence: 97 },
      { text: 'furosemide', label: 'Medication', confidence: 94 },
      { text: 'pulmonary oedema', label: 'Condition', confidence: 75 },
      { text: 'echocardiogram', label: 'Procedure', confidence: 55 },
      { text: 'heart failure', label: 'Condition', confidence: 80 },
    ];

    mockEntities.forEach((ent) => {
      const escapedText = ent.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexPattern = escapedText.replace(/\\s\+|\\n|\s+/g, '\\s+');
      const regex = new RegExp(regexPattern, 'i');
      const match = text.match(regex);

      if (match && match.index !== undefined) {
        this.annotationsService.createAnnotation({
          documentId,
          text: ent.text,
          label: ent.label as any,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          source: 'llm',
          status: 'suggested',
          confidence: ent.confidence,
        });
      }
    });
  }
}
