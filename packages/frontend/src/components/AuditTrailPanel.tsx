import { useAuditLogs } from '../hooks/queries/useAuditLogs';
import { 
  ShieldAlert, 
  Database, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  PlusCircle, 
  Edit,
  Clock,
  RefreshCw,
  Lock,
  ShieldCheck
} from 'lucide-react';
import styled, { keyframes } from 'styled-components';

interface Props {
  documentId: string;
}

export function AuditTrailPanel({ documentId }: Props) {
  const { data: logs, isLoading, error, refetch, isRefetching } = useAuditLogs(documentId);

  const getEventIcon = (actionType: string) => {
    switch (actionType) {
      case 'INGESTION_COMPLETED':
        return <IconWrapper $color="#3b82f6" $bg="rgba(59, 130, 246, 0.1)"><Database className="h-4 w-4" /></IconWrapper>;
      case 'LLM_EXTRACTION_SUCCESS':
        return <IconWrapper $color="#a855f7" $bg="rgba(168, 85, 247, 0.1)"><Sparkles className="h-4 w-4" /></IconWrapper>;
      case 'ANNOTATION_ACCEPTED':
        return <IconWrapper $color="#10b981" $bg="rgba(16, 185, 129, 0.1)"><CheckCircle2 className="h-4 w-4" /></IconWrapper>;
      case 'ANNOTATION_REJECTED':
        return <IconWrapper $color="#ef4444" $bg="rgba(239, 68, 68, 0.1)"><XCircle className="h-4 w-4" /></IconWrapper>;
      case 'ANNOTATION_CREATED':
        return <IconWrapper $color="#2563eb" $bg="rgba(37, 99, 235, 0.1)"><PlusCircle className="h-4 w-4" /></IconWrapper>;
      case 'ANNOTATION_UPDATED':
      case 'ANNOTATION_CORRECTED':
        return <IconWrapper $color="#d97706" $bg="rgba(217, 119, 6, 0.1)"><Edit className="h-4 w-4" /></IconWrapper>;
      default:
        return <IconWrapper $color="#6b7280" $bg="rgba(107, 114, 128, 0.1)"><Clock className="h-4 w-4" /></IconWrapper>;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatActionType = (action: string) => {
    if (action.startsWith('LLM_')) {
      return 'LLM ' + action.slice(4).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  if (documentId === 'preview') {
    return (
      <PanelContainer>
        <EmptyState>
          <ShieldAlert className="h-8 w-8 text-muted-foreground stroke-1 mb-2" />
          <EmptyTitle>Sandbox Preview Mode</EmptyTitle>
          <EmptyDesc>Compliance auditing and S3 WORM streaming are disabled for stateless preview notes.</EmptyDesc>
        </EmptyState>
      </PanelContainer>
    );
  }

  if (isLoading) {
    return (
      <PanelContainer>
        <LoadingState>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-muted-foreground mt-2">Loading audit trail...</span>
        </LoadingState>
      </PanelContainer>
    );
  }

  if (error) {
    return (
      <PanelContainer>
        <EmptyState>
          <ShieldAlert className="h-8 w-8 text-destructive stroke-1 mb-2" />
          <EmptyTitle>Audit Fetch Failed</EmptyTitle>
          <EmptyDesc>{error.message || 'Could not connect to the audit API.'}</EmptyDesc>
        </EmptyState>
      </PanelContainer>
    );
  }

  return (
    <PanelContainer>
      <Header>
        <TitleSection>
          <TitleRow>
            <ShieldIcon />
            <TitleText>Compliance Audit Trail</TitleText>
          </TitleRow>
          <WORMHeaderBadge>
            <PulsingDot />
            <span>S3 WORM Secured</span>
          </WORMHeaderBadge>
        </TitleSection>
        <RefreshButton onClick={() => refetch()} disabled={isRefetching} title="Refresh Logs">
          <RefreshIcon className={isRefetching ? 'animate-spin' : ''} />
        </RefreshButton>
      </Header>

      <LogsList>
        {!logs || logs.length === 0 ? (
          <EmptyState>
            <Clock className="h-8 w-8 text-muted-foreground stroke-1 mb-2" />
            <EmptyTitle>No logs recorded</EmptyTitle>
            <EmptyDesc>There are no audit events recorded for this note yet.</EmptyDesc>
          </EmptyState>
        ) : (
          <Timeline>
            {logs.map((log, idx) => (
              <TimelineItem key={log.logId || idx}>
                <TimelineConnector $isLast={idx === logs.length - 1} />
                <TimelineIconWrapper>
                  {getEventIcon(log.actionType)}
                </TimelineIconWrapper>
                <TimelineCard>
                  <CardHeader>
                    <EventBadge $type={log.actionType}>{formatActionType(log.actionType)}</EventBadge>
                    <span title="Immutably logged and WORM verified">
                      <WormLockIcon />
                    </span>
                  </CardHeader>
                  <EventDesc>{log.description}</EventDesc>
                  <EventTime>{formatTime(log.createdAt)} • {formatDate(log.createdAt)}</EventTime>
                </TimelineCard>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </LogsList>
    </PanelContainer>
  );
}

// --- Keyframes & Animations ---

const pulse = keyframes`
  0% {
    transform: scale(0.9);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
  }
  100% {
    transform: scale(0.9);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
`;

// --- Styled Components ---

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(15, 15, 19, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.05)'};
  transition: all 0.3s ease;
`;

const Header = styled.div`
  padding: 14px 20px;
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.015)'};
  border-bottom: 1px solid ${props => props.theme.colorBorderSecondary};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TitleSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ShieldIcon = styled(ShieldCheck)`
  color: ${props => props.theme.colorSuccess};
  width: 15px;
  height: 15px;
`;

const TitleText = styled.span`
  font-size: 11px;
  color: ${props => props.theme.colorText};
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

const WORMHeaderBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  color: ${props => props.theme.colorSuccess};
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)'};
  border: 1px solid rgba(16, 185, 129, 0.15);
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 600;
  width: fit-content;
`;

const PulsingDot = styled.div`
  width: 5px;
  height: 5px;
  background-color: #10b981;
  border-radius: 50%;
  animation: ${pulse} 2s infinite;
`;

const RefreshButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  color: ${props => props.theme.colorTextSecondary};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover:not(:disabled) {
    color: ${props => props.theme.colorText};
    background: ${props => props.theme.colorBgTextHover};
    transform: rotate(180deg);
  }
  &:active:not(:disabled) {
    transform: scale(0.9);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const RefreshIcon = styled(RefreshCw)`
  width: 14px;
  height: 14px;
`;

const LogsList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
    border-radius: 3px;
    &:hover {
      background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
    }
  }
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  height: 100%;
  padding: 40px;
`;

const EmptyTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colorText};
  margin-top: 8px;
  margin-bottom: 4px;
`;

const EmptyDesc = styled.p`
  font-size: 12px;
  color: ${props => props.theme.colorTextSecondary};
  max-width: 220px;
  line-height: 1.5;
`;

const Timeline = styled.div`
  display: flex;
  flex-direction: column;
`;

const TimelineConnector = styled.div<{ $isLast: boolean }>`
  position: absolute;
  left: 16px;
  top: 32px;
  bottom: -14px;
  width: 2px;
  background: ${props => props.$isLast ? 'transparent' : props.theme.colorBorderSecondary};
  transition: background-color 0.2s ease;
`;

const TimelineIconWrapper = styled.div`
  z-index: 10;
  flex-shrink: 0;
`;

const IconWrapper = styled.div<{ $color: string; $bg: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: ${props => props.$color};
  background: ${props => props.$bg};
  border: 1.5px solid ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'};
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
`;

const TimelineCard = styled.div`
  margin-left: 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)'};
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  border-radius: 10px;
  padding: 8px 10px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;

  &:hover {
    border-color: ${props => props.theme.colorPrimary}50;
    background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(99, 102, 241, 0.04)' : 'rgba(99, 102, 241, 0.02)'};
    transform: translateY(-1px);
    box-shadow: 0 4px 12px ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(99, 102, 241, 0.04)'};
  }
`;

const TimelineItem = styled.div`
  display: flex;
  position: relative;
  margin-bottom: 14px;
  
  &:last-child {
    margin-bottom: 4px;
  }

  &:hover ${IconWrapper} {
    transform: scale(1.06);
    border-color: currentColor;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.15);
  }

  &:hover ${TimelineConnector} {
    background: ${props => props.theme.colorBorder};
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
`;

const EventTime = styled.span`
  font-size: 9.5px;
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
  color: ${props => props.theme.colorTextSecondary};
  font-weight: 500;
  margin-top: 4px;
  align-self: flex-end;
`;

const WormLockIcon = styled(Lock)`
  width: 9px;
  height: 9px;
  opacity: 0.65;
  color: ${props => props.theme.colorTextSecondary};
`;

const EventBadge = styled.span<{ $type: string }>`
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 1.5px 5px;
  border-radius: 4px;
  white-space: nowrap;
  
  ${props => {
    switch (props.$type) {
      case 'INGESTION_COMPLETED':
        return `
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.15);
        `;
      case 'LLM_EXTRACTION_SUCCESS':
        return `
          color: #a855f7;
          background: rgba(168, 85, 247, 0.08);
          border: 1px solid rgba(168, 85, 247, 0.15);
        `;
      case 'ANNOTATION_ACCEPTED':
        return `
          color: #10b981;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.15);
        `;
      case 'ANNOTATION_REJECTED':
        return `
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.15);
        `;
      case 'ANNOTATION_CREATED':
        return `
          color: #2563eb;
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.15);
        `;
      case 'ANNOTATION_UPDATED':
      case 'ANNOTATION_CORRECTED':
        return `
          color: #d97706;
          background: rgba(217, 119, 6, 0.08);
          border: 1px solid rgba(217, 119, 6, 0.15);
        `;
      default:
        return `
          color: #6b7280;
          background: rgba(107, 114, 128, 0.08);
          border: 1px solid rgba(107, 114, 128, 0.15);
        `;
    }
  }}
`;

const EventDesc = styled.p`
  font-size: 11px;
  line-height: 1.4;
  color: ${props => props.theme.colorText};
  margin: 0;
  font-weight: 450;
  word-break: break-word;
`;
