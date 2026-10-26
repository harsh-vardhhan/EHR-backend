export interface ClinicianUser {
  sub: string;
  email: string;
  username: string;
}

export const STORAGE_TOKEN_KEY = 'ehr_clinician_id_token';
export const STORAGE_USER_KEY = 'ehr_clinician_user';

export const COGNITO_REGION = import.meta.env.VITE_COGNITO_REGION || 'ap-south-1';
export const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '70ujmsh53oof7rml3pm2v2k0rf';

/**
 * Returns the active Cognito ID token synchronously from storage.
 * Used by Eden Treaty / fetch headers.
 */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): ClinicianUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: ClinicianUser): void {
  try {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  } catch {
    // ignore localstorage errors in restricted contexts
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
  } catch {
    // ignore
  }
}

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export async function callCognitoInitiateAuth(email: string, password: string) {
  const response = await fetch(
    `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email.trim(),
          PASSWORD: password,
        },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    const message = data.message || data.__type || 'Authentication failed';
    throw new Error(message);
  }
  return data;
}

export async function callCognitoNewPasswordChallenge(
  email: string,
  newPassword: string,
  session: string,
) {
  const response = await fetch(
    `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
      },
      body: JSON.stringify({
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ClientId: COGNITO_CLIENT_ID,
        Session: session,
        ChallengeResponses: {
          USERNAME: email.trim(),
          NEW_PASSWORD: newPassword,
        },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    const message = data.message || data.__type || 'Failed to update permanent password';
    throw new Error(message);
  }
  return data;
}
