import type { Annotation } from '../types';
import { BarChart3, Target } from 'lucide-react';
import styled, { useTheme } from 'styled-components';
import { MEDICAL_LABELS } from '../constants/labels';

import { useSessionMetrics } from '../hooks/useSessionMetrics';

interface Props {
  annotations: Annotation[];
}

export function SessionMetrics({ annotations }: Props) {
  const { 
    suggestionsCount, 
    acceptedCount, 
    rejectedCount, 
    accuracy, 
    getLabelCount 
  } = useSessionMetrics(annotations);

  const theme = useTheme();
  const isDarkMode = theme.colorBgBase === '#09090b';

  return (
    <MetricsContainer>
      <SectionHeader>
        <StyledMetricsIcon />
        <HeaderText>Session Metrics</HeaderText>
      </SectionHeader>
      
      <MetricsOverviewCard>
        <CircularContainer>
          <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              stroke={isDarkMode ? '#27272a' : '#e4e4e7'}
              fill="transparent"
              strokeWidth="5"
              r="34"
              cx="40"
              cy="40"
            />
            <circle
              stroke={accuracy > 80 ? theme.colorSuccess : accuracy > 50 ? theme.colorPrimary : theme.colorError}
              fill="transparent"
              strokeWidth="5;;"
              strokeDasharray={String(2 * Math.PI * 34)}
              strokeDashoffset={String(2 * Math.PI * 34 - (accuracy / 100) * (2 * Math.PI * 34))}
              strokeLinecap="round"
              r="34"
              cx="40"
              cy="40"
              style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
            />
          </svg>
          <CircularValue>{accuracy}%</CircularValue>
        </CircularContainer>
        <OverviewStats>
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block whitespace-nowrap">Accuracy</span>
            <div style={{ fontSize: 20, fontWeight: 700, color: accuracy > 80 ? theme.colorSuccess : accuracy > 50 ? theme.colorPrimary : theme.colorError, lineHeight: 1.2 }}>
              {accuracy}%
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block whitespace-nowrap">AI Suggestions</span>
            <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.2 }}>
              <Target className="h-4 w-4" style={{ color: theme.colorPrimary }} /> {suggestionsCount}
            </div>
          </div>
        </OverviewStats>
      </MetricsOverviewCard>

      <SectionDivider />

      <MetricGrid>
        <MetricPill $type="success">
          <MetricLabelText>Accepted</MetricLabelText>
          <MetricValueText style={{ color: theme.colorSuccess }}>{acceptedCount}</MetricValueText>
        </MetricPill>
        <MetricPill $type="error">
          <MetricLabelText>Rejected</MetricLabelText>
          <MetricValueText style={{ color: theme.colorError }}>{rejectedCount}</MetricValueText>
        </MetricPill>
      </MetricGrid>

      <SectionDivider />

      <div>
        <LabelDistributionHeader>LABEL DISTRIBUTION</LabelDistributionHeader>
        <div className="flex flex-col gap-3 w-full">
          {['Clinical Condition', 'Medication Statement', 'Clinical Finding', 'Medical Procedure'].map(label => {
            const count = getLabelCount(label);
            const maxCount = Math.max(...['Clinical Condition', 'Medication Statement', 'Clinical Finding', 'Medical Procedure'].map(l => getLabelCount(l)), 1);
            const percentage = (count / maxCount) * 100;
            const labelConfig = MEDICAL_LABELS[label as keyof typeof MEDICAL_LABELS];
            const barColor = theme.colorPrimary;
            
            return (
              <LabelBarContainer key={label}>
                <LabelBarHeader>
                  <LabelHeaderLeft>
                    <IconSpan style={{ color: labelConfig?.border }}>
                      {labelConfig?.icon}
                    </IconSpan>
                    <DistributionLabel>{label}</DistributionLabel>
                  </LabelHeaderLeft>
                  <DistributionValue>{count}</DistributionValue>
                </LabelBarHeader>
                <ProgressBarOuter>
                  <ProgressBarInner $percentage={percentage} $color={barColor} />
                </ProgressBarOuter>
              </LabelBarContainer>
            );
          })}
        </div>
      </div>
    </MetricsContainer>
  );
}

// --- Styled Components ---

const MetricsContainer = styled.div`
  height: 100%;
  padding: 24px;
  overflow-y: auto;
  border-radius: 16px;
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(24, 24, 27, 0.7)' : 'rgba(255, 255, 255, 0.8)'} !important;
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.04)'};
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
`;

const HeaderText = styled.span`
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  color: ${props => props.theme.colorTextBase};
`;

const LabelDistributionHeader = styled.span`
  font-size: 11px;
  color: ${props => props.theme.colorTextSecondary};
  display: block;
  margin-bottom: 16px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-weight: 600;
`;

const StyledMetricsIcon = styled(BarChart3)`
  color: ${props => props.theme.colorPrimary};
  font-size: 18px;
  width: 18px;
  height: 18px;
`;

const SectionDivider = styled.hr`
  margin: 20px 0;
  border: 0;
  border-top: 1px solid ${props => props.theme.colorBorderSecondary};
`;

const DistributionLabel = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${props => props.theme.colorTextSecondary};
`;

const DistributionValue = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${props => props.theme.colorTextBase};
`;

const MetricsOverviewCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'};
  padding: 16px;
  border-radius: 12px;
  border: 1px solid ${props => props.theme.colorBorderSecondary};
`;

const CircularContainer = styled.div`
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CircularValue = styled.span`
  position: absolute;
  font-size: 15px;
  font-weight: 700;
  color: ${props => props.theme.colorTextBase};
`;

const OverviewStats = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const MetricPill = styled.div<{ $type: 'success' | 'error' }>`
  background: ${props => {
    const isDark = props.theme.colorBgBase === '#09090b';
    if (props.$type === 'success') {
      return isDark ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)';
    }
    return isDark ? 'rgba(239, 68, 68, 0.04)' : 'rgba(239, 68, 68, 0.02)';
  }};
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MetricLabelText = styled.span`
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: ${props => props.theme.colorTextSecondary} !important;
`;

const MetricValueText = styled.span`
  font-size: 20px;
  font-weight: 700;
`;

const LabelBarContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const LabelBarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const LabelHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IconSpan = styled.span`
  display: flex;
  align-items: center;
  font-size: 14px;
`;

const ProgressBarOuter = styled.div`
  width: 100%;
  height: 4px;
  background: ${props => props.theme.colorBorderSecondary};
  border-radius: 2px;
  overflow: hidden;
`;

const ProgressBarInner = styled.div<{ $percentage: number; $color: string }>`
  width: ${props => props.$percentage}%;
  height: 100%;
  background: ${props => props.$color};
  border-radius: 2px;
  transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
`;
