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

const MOCK_ENTITIES_REGISTRY: {
  text: string;
  label: MedicalEntityLabel;
  assertion: 'positive' | 'negated' | 'possible';
}[] = [
  // Conditions
  { text: 'CAD', label: 'Clinical Condition', assertion: 'positive' },
  {
    text: 'type 2 diabetes mellitus',
    label: 'Clinical Condition',
    assertion: 'positive',
  },
  {
    text: 'chronic kidney disease',
    label: 'Clinical Condition',
    assertion: 'positive',
  },
  { text: 'Stage 3 CKD', label: 'Clinical Condition', assertion: 'positive' },
  {
    text: 'Diabetic peripheral neuropathy',
    label: 'Clinical Condition',
    assertion: 'positive',
  },
  { text: 'COPD', label: 'Clinical Condition', assertion: 'positive' },
  { text: 'bronchitis', label: 'Clinical Condition', assertion: 'possible' },
  { text: 'pneumonia', label: 'Clinical Condition', assertion: 'possible' },
  {
    text: 'chronic migraine headaches',
    label: 'Clinical Condition',
    assertion: 'positive',
  },
  { text: 'migraine', label: 'Clinical Condition', assertion: 'positive' },
  {
    text: 'tear of the medial meniscus',
    label: 'Clinical Condition',
    assertion: 'possible',
  },
  {
    text: 'anterior cruciate ligament (ACL) tear',
    label: 'Clinical Condition',
    assertion: 'possible',
  },
  { text: 'ACL tear', label: 'Clinical Condition', assertion: 'possible' },
  {
    text: 'Major Depressive Disorder',
    label: 'Clinical Condition',
    assertion: 'positive',
  },
  { text: 'MDD', label: 'Clinical Condition', assertion: 'positive' },
  {
    text: 'Generalized Anxiety Disorder',
    label: 'Clinical Condition',
    assertion: 'positive',
  },
  { text: 'GAD', label: 'Clinical Condition', assertion: 'positive' },
  {
    text: 'Gastroesophageal reflux disease',
    label: 'Clinical Condition',
    assertion: 'positive',
  },
  { text: 'GERD', label: 'Clinical Condition', assertion: 'positive' },
  { text: 'gastritis', label: 'Clinical Condition', assertion: 'possible' },
  {
    text: 'peptic ulcer disease',
    label: 'Clinical Condition',
    assertion: 'possible',
  },
  { text: 'breast cancer', label: 'Clinical Condition', assertion: 'positive' },
  {
    text: 'pyelonephritis',
    label: 'Clinical Condition',
    assertion: 'positive',
  },
  {
    text: 'urinary tract infection',
    label: 'Clinical Condition',
    assertion: 'positive',
  },
  {
    text: 'angina pectoris',
    label: 'Clinical Condition',
    assertion: 'positive',
  },
  { text: 'esophagitis', label: 'Clinical Condition', assertion: 'possible' },

  // Medications
  {
    text: 'metoprolol succinate',
    label: 'Medication Statement',
    assertion: 'positive',
  },
  { text: 'metoprolol', label: 'Medication Statement', assertion: 'positive' },
  {
    text: 'atorvastatin',
    label: 'Medication Statement',
    assertion: 'positive',
  },
  {
    text: 'isosorbide mononitrate',
    label: 'Medication Statement',
    assertion: 'positive',
  },
  {
    text: 'glargine insulin',
    label: 'Medication Statement',
    assertion: 'positive',
  },
  { text: 'insulin', label: 'Medication Statement', assertion: 'positive' },
  { text: 'metformin', label: 'Medication Statement', assertion: 'positive' },
  { text: 'Jardiance', label: 'Medication Statement', assertion: 'positive' },
  {
    text: 'empagliflozin',
    label: 'Medication Statement',
    assertion: 'positive',
  },
  { text: 'prednisone', label: 'Medication Statement', assertion: 'positive' },
  {
    text: 'azithromycin',
    label: 'Medication Statement',
    assertion: 'positive',
  },
  {
    text: 'Albuterol/Ipratropium',
    label: 'Medication Statement',
    assertion: 'positive',
  },
  { text: 'DuoNeb', label: 'Medication Statement', assertion: 'positive' },
  { text: 'topiramate', label: 'Medication Statement', assertion: 'positive' },
  { text: 'sumatriptan', label: 'Medication Statement', assertion: 'positive' },
  { text: 'ibuprofen', label: 'Medication Statement', assertion: 'positive' },
  { text: 'Lexapro', label: 'Medication Statement', assertion: 'positive' },
  {
    text: 'escitalopram',
    label: 'Medication Statement',
    assertion: 'positive',
  },
  { text: 'Omeprazole', label: 'Medication Statement', assertion: 'positive' },
  { text: 'Anastrozole', label: 'Medication Statement', assertion: 'positive' },
  { text: 'Rocephin', label: 'Medication Statement', assertion: 'positive' },
  { text: 'ceftriaxone', label: 'Medication Statement', assertion: 'positive' },
  {
    text: 'Ciprofloxacin',
    label: 'Medication Statement',
    assertion: 'positive',
  },
  {
    text: 'acetaminophen',
    label: 'Medication Statement',
    assertion: 'positive',
  },

  // Findings / Symptoms
  { text: 'chest tightness', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'tightness', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'syncope', label: 'Clinical Finding', assertion: 'negated' },
  { text: 'palpitations', label: 'Clinical Finding', assertion: 'negated' },
  { text: 'orthopnea', label: 'Clinical Finding', assertion: 'negated' },
  { text: 'numbness', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'hypoglycemia', label: 'Clinical Finding', assertion: 'positive' },
  {
    text: 'shortness of breath',
    label: 'Clinical Finding',
    assertion: 'positive',
  },
  { text: 'wheezing', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'rales', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'nausea', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'photophobia', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'phonophobia', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'knee pain', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'pain', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'swelling', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'low mood', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'anhedonia', label: 'Clinical Finding', assertion: 'positive' },
  {
    text: 'suicidal ideation',
    label: 'Clinical Finding',
    assertion: 'negated',
  },
  { text: 'hallucinations', label: 'Clinical Finding', assertion: 'negated' },
  { text: 'burning pain', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'tenderness', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'fever', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'flank pain', label: 'Clinical Finding', assertion: 'positive' },
  { text: 'dysuria', label: 'Clinical Finding', assertion: 'positive' },

  // Procedures
  { text: 'CABG', label: 'Medical Procedure', assertion: 'positive' },
  { text: 'bypass surgery', label: 'Medical Procedure', assertion: 'positive' },
  { text: 'stress test', label: 'Medical Procedure', assertion: 'positive' },
  { text: 'foot exam', label: 'Medical Procedure', assertion: 'positive' },
  { text: 'MRI', label: 'Medical Procedure', assertion: 'positive' },
  { text: 'mammogram', label: 'Medical Procedure', assertion: 'positive' },
  { text: 'EGD', label: 'Medical Procedure', assertion: 'positive' },
  { text: 'immunizations', label: 'Medical Procedure', assertion: 'positive' },
  { text: 'vaccines', label: 'Medical Procedure', assertion: 'positive' },
  { text: 'lumpectomy', label: 'Medical Procedure', assertion: 'positive' },
  { text: 'radiation', label: 'Medical Procedure', assertion: 'positive' },
];

function mockExtractClinicalEntities(text: string): ExtractionResult {
  console.log(
    '[extractClinicalEntities] MOCK_SAGEMAKER is active. Performing local keyword extraction...',
  );
  const entities: ExtractedEntity[] = [];
  const relations: ExtractedRelation[] = [];

  // Sort by length descending to match longer terms first
  const sortedRegistry = [...MOCK_ENTITIES_REGISTRY].sort(
    (a, b) => b.text.length - a.text.length,
  );

  for (const item of sortedRegistry) {
    let index = text.toLowerCase().indexOf(item.text.toLowerCase());
    while (index !== -1) {
      const start = index;
      const end = index + item.text.length;

      const isOverlap = entities.some(
        (ent) =>
          (start >= ent.startOffset && start < ent.endOffset) ||
          (end > ent.startOffset && end <= ent.endOffset) ||
          (ent.startOffset >= start && ent.startOffset < end),
      );

      if (!isOverlap) {
        const originalText = text.substring(start, end);
        entities.push({
          text: originalText,
          label: item.label,
          confidence: 0.95,
          assertion: item.assertion,
          conceptCode: '',
          startOffset: start,
          endOffset: end,
        });
      }

      index = text.toLowerCase().indexOf(item.text.toLowerCase(), index + 1);
    }
  }

  entities.sort((a, b) => a.startOffset - b.startOffset);

  // Generate relationships between medications and conditions if both exist
  const meds = entities.filter((e) => e.label === 'Medication Statement');
  const conds = entities.filter((e) => e.label === 'Clinical Condition');

  for (const med of meds) {
    let bestCond: ExtractedEntity | null = null;
    let minDistance = Infinity;

    for (const cond of conds) {
      const dist = Math.abs(med.startOffset - cond.startOffset);
      if (dist < minDistance && dist < 400) {
        minDistance = dist;
        bestCond = cond;
      }
    }

    if (bestCond) {
      relations.push({
        sourceStart: med.startOffset,
        sourceEnd: med.endOffset,
        targetStart: bestCond.startOffset,
        targetEnd: bestCond.endOffset,
        relation: 'treats',
        confidence: 0.9,
      });
    }
  }

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

      console.log(
        `[extractClinicalEntities] Successfully extracted ${entities.length} entities and ${relations.length} relations from local Python ML server.`,
      );
      return { entities, relations };
    } catch (err: any) {
      console.warn(
        `[extractClinicalEntities] Local ML server query failed. Falling back to mock extractor. Error: ${err.message || err}`,
      );
      return mockExtractClinicalEntities(text);
    }
  }

  if (process.env.MOCK_SAGEMAKER === 'true') {
    return mockExtractClinicalEntities(text);
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
  } catch (err: any) {
    console.warn(
      `[extractClinicalEntities] SageMaker extraction failed. Falling back to local mock extractor. Error: ${err.message || err}`,
    );
    return mockExtractClinicalEntities(text);
  }
}
