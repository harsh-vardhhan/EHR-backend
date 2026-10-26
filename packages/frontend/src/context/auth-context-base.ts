import { createContext } from 'react';
import type { ClinicianUser } from '../lib/auth';

export interface AuthContextType {
  user: ClinicianUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  isAuthModalOpen: boolean;
  newPasswordRequired: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  loginAsDemo: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
