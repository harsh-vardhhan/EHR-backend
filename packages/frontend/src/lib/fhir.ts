import type { Annotation, Document } from '../types';

export function generateFhirResource(
  doc: Document | { id: string; title?: string; category?: string },
  annotations: Annotation[]
) {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: annotations.map((ann) => {
      const isMed = ann.label === 'Medication Statement';
      return {
        resource: {
          resourceType: isMed ? 'MedicationStatement' : 'Condition',
          id: ann.id,
          subject: {
            reference: `Patient/${doc.id}-patient`,
            display: `Patient for Record ${doc.id}`,
          },
          status: ann.assertion === 'negated' ? 'entered-in-error' : 'active',
          code: {
            coding: [
              {
                system: isMed
                  ? 'http://www.nlm.nih.gov/research/umls/rxnorm'
                  : 'http://hl7.org/fhir/sid/icd-10-cm',
                code: ann.conceptCode || 'unknown',
                display: ann.text,
              },
            ],
            text: ann.text,
          },
          note: [
            {
              text: `Extracted via Clinical NLP. Assertion status: ${ann.assertion || 'positive'}. Confidence: ${Math.round((ann.confidence || 1) * 100)}%`,
            },
          ],
        },
      };
    }),
  };
}
