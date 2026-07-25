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
