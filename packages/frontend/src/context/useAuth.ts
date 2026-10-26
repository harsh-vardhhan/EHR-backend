import { useContext } from 'react';
import { AuthContext } from './auth-context-base';
import type { AuthContextType } from './auth-context-base';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
