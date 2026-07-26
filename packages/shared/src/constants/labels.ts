/**
 * Centralized configuration for medical entity labels.
 * This is the Single Source of Truth for colors, labels, and icons.
 *
 * NOTE: This configuration is duplicated in the Frontend repository at:
 * frontend/src/constants/labels.ts
 *
 * Because frontend and backend are hosted in separate Git repositories,
 * any changes made here MUST be manually duplicated on the frontend as well.
 */
export const MEDICAL_ENTITIES = {
  CONDITION: 'Clinical Condition',
  MEDICATION: 'Medication Statement',
  FINDING: 'Clinical Finding',
  PROCEDURE: 'Medical Procedure',
} as const;

export type MedicalEntityLabel =
  (typeof MEDICAL_ENTITIES)[keyof typeof MEDICAL_ENTITIES];
