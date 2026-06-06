/**
 * Centralized configuration for medical entity labels.
 * This is the Single Source of Truth for colors, labels, and icons.
 */
export const MEDICAL_ENTITIES = {
  CONDITION: 'Clinical Condition',
  MEDICATION: 'Medication Statement',
  FINDING: 'Clinical Finding',
  PROCEDURE: 'Medical Procedure',
} as const;

export type MedicalEntityLabel =
  (typeof MEDICAL_ENTITIES)[keyof typeof MEDICAL_ENTITIES];
