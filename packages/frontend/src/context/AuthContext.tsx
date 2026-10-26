import React, { useState } from 'react';
import {
  type ClinicianUser,
  getAuthToken,
  getStoredUser,
  setStoredSession,
  clearStoredSession,
  parseJwtPayload,
  callCognitoInitiateAuth,
  callCognitoNewPasswordChallenge,
} from '../lib/auth';
import { AuthContext } from './auth-context-base';

function getValidInitialToken(): string | null {
  const token = getAuthToken();
  if (token && token !== 'valid-clinician-token') {
    const payload = parseJwtPayload(token);
    if (payload && typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      clearStoredSession();
      return null;
    }
  }
  return token;
}

function getValidInitialUser(): ClinicianUser | null {
  const token = getValidInitialToken();
  return token ? getStoredUser() : null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(getValidInitialToken);
  const [user, setUser] = useState<ClinicianUser | null>(getValidInitialUser);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Cognito Challenge state
  const [newPasswordRequired, setNewPasswordRequired] = useState<boolean>(false);
  const [challengeSession, setChallengeSession] = useState<string | null>(null);
  const [challengeEmail, setChallengeEmail] = useState<string>('');

  const logout = () => {
    setToken(null);
    setUser(null);
    setNewPasswordRequired(false);
    setChallengeSession(null);
    clearStoredSession();
  };

  const openAuthModal = () => {
    setAuthError(null);
    setNewPasswordRequired(false);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthError(null);
    setNewPasswordRequired(false);
    setChallengeSession(null);
  };

  const storeSession = (idToken: string, userObj: ClinicianUser) => {
    setToken(idToken);
    setUser(userObj);
    setStoredSession(idToken, userObj);
  };

  const loginAsDemo = () => {
    const demoUser: ClinicianUser = {
      sub: 'clinician-uuid-001',
      email: 'dr.smith@hospital.org',
      username: 'dr_smith',
    };
    storeSession('valid-clinician-token', demoUser);
    closeAuthModal();
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const data = await callCognitoInitiateAuth(email, password);

      // Handle Admin-Created First Login Temporary Password Challenge
      if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        setNewPasswordRequired(true);
        setChallengeSession(data.Session);
        setChallengeEmail(email.trim());
        return;
      }

      if (data.AuthenticationResult?.IdToken) {
        const idToken = data.AuthenticationResult.IdToken;
        const payload = parseJwtPayload(idToken);
        const clinicianUser: ClinicianUser = {
          sub: (payload?.sub as string) || 'clinician',
          email: (payload?.email as string) || email.trim(),
          username: ((payload?.['cognito:username'] || payload?.username) as string) || email.trim(),
        };

        storeSession(idToken, clinicianUser);
        closeAuthModal();
      } else {
        throw new Error('No authentication tokens returned by Cognito.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check credentials.';
      setAuthError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const completeNewPassword = async (newPassword: string) => {
    if (!challengeSession || !challengeEmail) {
      throw new Error('No active password challenge session.');
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      const data = await callCognitoNewPasswordChallenge(challengeEmail, newPassword, challengeSession);

      if (data.AuthenticationResult?.IdToken) {
        const idToken = data.AuthenticationResult.IdToken;
        const payload = parseJwtPayload(idToken);
        const clinicianUser: ClinicianUser = {
          sub: (payload?.sub as string) || 'clinician',
          email: (payload?.email as string) || challengeEmail,
          username: ((payload?.['cognito:username'] || payload?.username) as string) || challengeEmail,
        };

        storeSession(idToken, clinicianUser);
        closeAuthModal();
      } else {
        throw new Error('Password updated, please sign in with your new permanent password.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set permanent password.';
      setAuthError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        authError,
        isAuthModalOpen,
        newPasswordRequired,
        openAuthModal,
        closeAuthModal,
        login,
        completeNewPassword,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
