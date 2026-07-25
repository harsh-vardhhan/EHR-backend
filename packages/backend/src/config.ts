import { t } from 'elysia';
import { Value } from '@sinclair/typebox/value';

/**
 * TypeBox Schema for Application Environment Variables
 */
export const EnvSchema = t.Object(
  {
    NODE_ENV: t.Optional(
      t.Union(
        [t.Literal('development'), t.Literal('production'), t.Literal('test')],
        { error: 'NODE_ENV must be "development", "production", or "test"' },
      ),
    ),
    PORT: t.Optional(
      t.String({
        pattern: '^[0-9]+$',
        error: 'PORT must be a numeric string',
      }),
    ),
    AWS_REGION: t.Optional(t.String()),
    EHR_TABLE_NAME: t.Optional(t.String()),
    DOCUMENTS_BUCKET_NAME: t.Optional(t.String()),
    ANNOTATION_QUEUE_URL: t.Optional(t.String()),
    AUDIT_DELIVERY_STREAM_NAME: t.Optional(t.String()),
    OMOP_DELIVERY_STREAM_NAME: t.Optional(t.String()),
    BACKEND_FUNCTION_NAME: t.Optional(t.String()),
    ORIGIN_VERIFY_SECRET: t.Optional(t.String()),
    API_KEY: t.Optional(t.String()),
    LOCAL_ML_URL: t.Optional(t.String()),
    SAGEMAKER_ENDPOINT_NAME: t.Optional(t.String()),
    ALLOWED_ORIGINS: t.Optional(t.String()),
  },
  { additionalProperties: true },
);

export interface ValidateEnvOptions {
  throwOnError?: boolean;
}

/**
 * Fail-fast boot-time validation using TypeBox.
 * Validates process.env against EnvSchema and enforces strict required keys (including API_KEY) in production.
 */
export function validateEnv(
  env: Record<string, string | undefined> = process.env,
  options: ValidateEnvOptions = {},
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const schemaErrors = [...Value.Errors(EnvSchema, env)];
  for (const err of schemaErrors) {
    const field = err.path.replace('/', '');
    errors.push(`[${field || 'env'}] ${err.message}`);
  }

  if (env.NODE_ENV === 'production') {
    const requiredProdVars = [
      'DOCUMENTS_BUCKET_NAME',
      'EHR_TABLE_NAME',
      'API_KEY',
    ];
    for (const key of requiredProdVars) {
      if (!env[key] || env[key]?.trim() === '') {
        errors.push(`Missing required production variable: ${key}`);
      }
    }
  }

  const shouldThrow =
    options.throwOnError ??
    (env.NODE_ENV === 'production' && errors.length > 0);

  if (errors.length > 0) {
    console.error('❌ Boot-Time Environment Variable Validation Failed:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    if (shouldThrow) {
      throw new Error(
        `Boot-Time Config Validation Failed:\n${errors.join('\n')}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// Perform fail-fast validation on import
validateEnv();

/**
 * Centralized Application Configuration
 * Encapsulates environment variables with getter accessors to support dynamic runtime overrides (e.g. unit tests).
 */
export const config = {
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },

  get port(): number {
    return Number(process.env.PORT ?? 3000);
  },

  get awsRegion(): string {
    return process.env.AWS_REGION || 'ap-south-1';
  },

  get tableName(): string {
    return process.env.EHR_TABLE_NAME || 'ehr-table';
  },

  get documentsBucketName(): string {
    return process.env.DOCUMENTS_BUCKET_NAME || 'ehr-demo-docs-bucket';
  },

  get annotationQueueUrl(): string | undefined {
    return process.env.ANNOTATION_QUEUE_URL;
  },

  get auditDeliveryStreamName(): string | undefined {
    return process.env.AUDIT_DELIVERY_STREAM_NAME;
  },

  get omopDeliveryStreamName(): string | undefined {
    return process.env.OMOP_DELIVERY_STREAM_NAME;
  },

  get backendFunctionName(): string | undefined {
    return process.env.BACKEND_FUNCTION_NAME;
  },

  get isLambda(): boolean {
    return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  },

  get allowedOrigins(): Set<string> {
    const defaultProdOrigin = 'https://ehr-backend-frontend.vercel.app';
    const envOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      : [defaultProdOrigin];
    const devOrigins = !this.isProduction
      ? ['http://localhost:5173', 'http://localhost:3000']
      : [];
    return new Set([...envOrigins, ...devOrigins]);
  },

  get originVerifySecret(): string | undefined {
    return process.env.ORIGIN_VERIFY_SECRET;
  },

  get apiKey(): string | undefined {
    return process.env.API_KEY;
  },

  get localMlUrl(): string | undefined {
    return process.env.LOCAL_ML_URL;
  },

  get sagemakerEndpointName(): string {
    return process.env.SAGEMAKER_ENDPOINT_NAME || 'gliner-relex-endpoint';
  },
};
