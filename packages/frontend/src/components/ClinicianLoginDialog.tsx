import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from './ui/toast';
import { ShieldCheck, Lock, AlertCircle } from 'lucide-react';

export function ClinicianLoginDialog() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    login,
    completeNewPassword,
    isLoading,
    authError,
    newPasswordRequired,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (newPasswordRequired) {
      if (newPassword.length < 12) {
        setLocalError('Password must be at least 12 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      try {
        await completeNewPassword(newPassword);
        toast.success('Permanent password set successfully! Signed in.');
      } catch (err: unknown) {
        setLocalError(err instanceof Error ? err.message : 'Failed to set password');
      }
      return;
    }

    if (!email.trim() || !password) {
      setLocalError('Please enter both clinician email and password.');
      return;
    }

    try {
      await login(email, password);
      toast.success(`Welcome, signed in as ${email}`);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Invalid credentials');
    }
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <DialogTitle>Sign in</DialogTitle>
          </div>
          <DialogDescription>
            {newPasswordRequired
              ? 'First sign-in detected. Please establish your permanent password.'
              : 'Enter your clinician email and password to sign in.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {newPasswordRequired ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  New Permanent Password (min 12 chars)
                </label>
                <Input
                  type="password"
                  placeholder="Enter secure permanent password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  placeholder="Re-enter permanent password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Clinician Email
                </label>
                <Input
                  type="email"
                  placeholder="doctor@hospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {(localError || authError) && (
            <div className="flex items-start gap-2 p-3 text-xs bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{localError || authError}</span>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full gap-2 font-medium"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Sign in
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
