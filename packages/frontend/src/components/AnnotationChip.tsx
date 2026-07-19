import type { Annotation } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Segmented } from './ui/segmented';
import { Check, X, FlaskConical, Undo } from 'lucide-react';
import styled, { css } from 'styled-components';
import { MEDICAL_LABELS } from '../constants/labels';
import { ANNOTATION_STATUS, ANNOTATION_SOURCE } from '../constants/status';

interface Props {
  annotation: Annotation;
  onUpdate?: (updates: Partial<Annotation>) => void;
  onClick?: () => void;
}

export function AnnotationChip({ annotation, onUpdate, onClick }: Props) {
  const { label, text, status, confidence, source, assertion, conceptCode } = annotation;

  const labelConfig = MEDICAL_LABELS[label as keyof typeof MEDICAL_LABELS] || { color: 'default', description: '' };
  const isSuggested = status === ANNOTATION_STATUS.SUGGESTED;

  return (
    <StyledChipCard
      onClick={onClick}
      $isSuggested={isSuggested}
      $label={label}
    >
      <div className="flex flex-col gap-2 w-full">
        {/* Line 1: Highlighted Text + Assertion/AI Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 8 }}>
          <span className="text-[15px] font-bold text-inherit block leading-snug">
            "{text}"
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {source === ANNOTATION_SOURCE.LLM && (
              <Badge variant="info" className="text-[9px] px-1 py-0 font-medium h-4">
                <FlaskConical className="h-2.5 w-2.5 mr-0.5" /> AI
              </Badge>
            )}
            {assertion === 'negated' && (
              <Badge variant="destructive" className="text-[9px] px-1 py-0 font-bold h-4">NEGATED</Badge>
            )}
            {assertion === 'possible' && (
              <Badge variant="warning" className="text-[9px] px-1 py-0 font-bold h-4">POSSIBLE</Badge>
            )}
          </div>
        </div>
        
        {/* Line 2: Clinical Category/Taxonomy + Reference Code */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, width: '100%' }}>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {label.replace(' Statement', '').replace('Clinical ', '')} • {labelConfig.description}
          </span>
          {conceptCode && (
            <span className="text-[10px] font-semibold text-muted-foreground font-mono">
              {conceptCode}
            </span>
          )}
        </div>

        {/* Line 3: Assertion Toggle (Visible on Hover) */}
        {onUpdate && status !== ANNOTATION_STATUS.REJECTED && (
          <ToggleContainer onClick={(e) => e.stopPropagation()}>
            <Segmented
              size="small"
              value={assertion || 'positive'}
              onChange={(value) => onUpdate({ assertion: value as Annotation['assertion'] })}
              options={[
                { label: 'Positive', value: 'positive' },
                { label: 'Negated', value: 'negated' },
                { label: 'Possible', value: 'possible' },
              ]}
              block
            />
          </ToggleContainer>
        )}
        
        {/* Line 4 (Footer): Match percentage + Action triggers */}
        <FooterRow style={{ marginTop: 4 }}>
          {confidence !== undefined ? (
            <ConfidenceText>
              AI Match: {(confidence > 1 ? confidence : confidence * 100).toFixed(0)}%
            </ConfidenceText>
          ) : (
            <ConfidenceText>
              Reviewer Label
            </ConfidenceText>
          )}
          
          <ActionGroup>
            {isSuggested && onUpdate && (
              <div className="flex items-center gap-1.5">
                <Button 
                  variant="default"
                  size="sm" 
                  className="h-6 w-6 p-0 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ status: ANNOTATION_STATUS.ACCEPTED });
                  }}
                  title="Accept suggestion"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  variant="destructive"
                  size="sm" 
                  className="h-6 w-6 p-0 rounded-md flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ status: ANNOTATION_STATUS.REJECTED });
                  }}
                  title="Reject suggestion"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            
            {(status === ANNOTATION_STATUS.ACCEPTED || status === ANNOTATION_STATUS.REJECTED) && onUpdate && (
              <Button 
                variant="ghost"
                size="sm" 
                className="h-6 w-6 p-0 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ status: ANNOTATION_STATUS.SUGGESTED });
                }}
                title={`Undo ${status}`}
              >
                <Undo className="h-3.5 w-3.5" />
              </Button>
            )}
          </ActionGroup>
        </FooterRow>
      </div>
    </StyledChipCard>
  );
}

// --- Styled Components ---

const StyledChipCard = styled.div<{ $isSuggested: boolean; $label: string }>`
  margin-bottom: 8px;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  padding: 12px 14px;
  
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'};
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  
  /* Left Accent border to signal category color */
  border-left: 4px solid ${props => {
    const config = MEDICAL_LABELS[props.$label as keyof typeof MEDICAL_LABELS];
    return config?.border || props.theme.colorBorderSecondary;
  }};
  
  ${props => props.$isSuggested && css`
    box-shadow: 0 4px 12px ${props.theme.colorPrimary}15;
    border-color: ${props.theme.colorPrimary}50;
  `}

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.04)'};
    border-color: ${props => {
      const config = MEDICAL_LABELS[props.$label as keyof typeof MEDICAL_LABELS];
      return config ? config.border : props.theme.colorPrimary;
    }}80;
  }
`;

const FooterRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2px;
`;

const ActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ToggleContainer = styled.div`
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  margin-top: 0;
  
  /* Hover reveal effect */
  ${StyledChipCard}:hover & {
    max-height: 40px;
    opacity: 1;
    margin-top: 8px;
    margin-bottom: 4px;
  }
`;

const ConfidenceText = styled.span`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-weight: 500;
  color: ${props => props.theme.colorTextSecondary};
`;
