import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { config } from 'shared';

export interface AuthenticatedClinician {
  sub: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}

// In-memory Cognito JWT Verifier (cached JWKS, sub-ms verification)
let verifier: any = null;

export function getCognitoVerifier() {
  if (!verifier && config.cognitoUserPoolId && config.cognitoClientId) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: config.cognitoUserPoolId,
      tokenUse: 'id',
      clientId: config.cognitoClientId,
    });
  }
  return verifier;
}

/**
 * Verifies the incoming Authorization header.
 * In production: validates the RSA-signed Cognito ID token against Cognito JWKS.
 * In test/dev environments without a live Cognito pool: supports deterministic mock/test tokens.
 */
export async function verifyClinicianAuth(
  authHeader: string | null | undefined,
): Promise<AuthenticatedClinician | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  // Test and non-production fallback for local development & unit testing
  if (
    !config.isProduction &&
    (!config.cognitoUserPoolId || config.nodeEnv === 'test')
  ) {
    if (token === 'valid-clinician-token' || token.startsWith('mock-')) {
      return {
        sub: 'clinician-uuid-001',
        email: 'dr.smith@hospital.org',
        username: 'dr_smith',
      };
    }
  }

  const jwtVerifier = getCognitoVerifier();
  if (!jwtVerifier) {
    // If running in development without a Cognito pool configured
    if (
      !config.isProduction &&
      (token === 'valid-clinician-token' || token.startsWith('mock-'))
    ) {
      return {
        sub: 'dev-clinician-uuid',
        email: 'dev-clinician@hospital.org',
        username: 'dev_clinician',
      };
    }
    return null;
  }

  try {
    const payload = await jwtVerifier.verify(token);
    return {
      sub: payload.sub,
      email: payload.email as string | undefined,
      username: (payload['cognito:username'] || payload.username) as
        string | undefined,
    };
  } catch {
    return null;
  }
}
