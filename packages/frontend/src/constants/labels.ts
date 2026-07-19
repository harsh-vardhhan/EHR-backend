import { Stethoscope, FlaskConical, Lightbulb, ClipboardCheck } from 'lucide-react';
import React from 'react';

/**
 * Centralized configuration for medical entity labels.
 * This is the Single Source of Truth for colors, labels, and icons.
 *
 * NOTE: This configuration is duplicated in the Backend repository at:
 * backend/src/constants/labels.ts
 *
 * Because frontend and backend are hosted in separate Git repositories,
 * any changes made here MUST be manually duplicated in the backend constants folder.
 */
export const MEDICAL_ENTITIES = {
  CONDITION: 'Clinical Condition',
  MEDICATION: 'Medication Statement',
  FINDING: 'Clinical Finding',
  PROCEDURE: 'Medical Procedure',
} as const;

export const MEDICAL_LABELS = {
  [MEDICAL_ENTITIES.CONDITION]: {
    id: MEDICAL_ENTITIES.CONDITION,
    color: 'cyan',
    bg: '#e6fffb',
    border: '#13c2c2',
    hover: '#b5f5ec',
    description: 'ICD-10-CM',
    icon: React.createElement(Stethoscope, { className: "h-4 w-4" }),
  },
  [MEDICAL_ENTITIES.MEDICATION]: {
    id: MEDICAL_ENTITIES.MEDICATION,
    color: 'orange',
    bg: '#fff7e6',
    border: '#fa8c16',
    hover: '#ffe7ba',
    description: 'RxNorm',
    icon: React.createElement(FlaskConical, { className: "h-4 w-4" }),
  },
  [MEDICAL_ENTITIES.FINDING]: {
    id: MEDICAL_ENTITIES.FINDING,
    color: 'green',
    bg: '#f6ffed',
    border: '#52c41a',
    hover: '#d9f7be',
    description: 'SNOMED-CT',
    icon: React.createElement(Lightbulb, { className: "h-4 w-4" }),
  },
  [MEDICAL_ENTITIES.PROCEDURE]: {
    id: MEDICAL_ENTITIES.PROCEDURE,
    color: 'blue',
    bg: '#f0f5ff',
    border: '#2f54eb',
    hover: '#d6e4ff',
    description: 'CPT/SNOMED-CT',
    icon: React.createElement(ClipboardCheck, { className: "h-4 w-4" }),
  },
} as const;

export type LabelId = keyof typeof MEDICAL_LABELS;
export const LABEL_IDS = Object.keys(MEDICAL_LABELS) as LabelId[];
