import { useAuth } from '../context/useAuth';
import { Button } from './ui/button';
import { Lock, LogOut, UserCheck } from 'lucide-react';
import styled from 'styled-components';

export function ClinicianAuthBadge() {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  if (isAuthenticated && user) {
    return (
      <BadgeWrapper>
        <ClinicianPill title={`Authenticated Clinician: ${user.email}`}>
          <StatusDot />
          <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
          <ClinicianName>{user.email}</ClinicianName>
        </ClinicianPill>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          title="Sign out as clinician"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </BadgeWrapper>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={openAuthModal}
      className="h-8 gap-1.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 transition-colors"
    >
      <Lock className="h-3.5 w-3.5" />
      <span>Sign in</span>
    </Button>
  );
}

// --- Styled Components ---

const BadgeWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ClinicianPill = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  background: ${(props) =>
    props.theme.colorBgBase === '#09090b'
      ? 'rgba(16, 185, 129, 0.08)'
      : 'rgba(16, 185, 129, 0.08)'};
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 9999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  color: ${(props) => props.theme.colorText};
  max-width: 200px;

  @media (min-width: 640px) {
    max-width: 260px;
  }
`;

const StatusDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 6px #10b981;
  flex-shrink: 0;
`;

const ClinicianName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
