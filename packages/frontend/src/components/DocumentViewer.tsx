import { memo, useState } from 'react';
import type { RefObject } from 'react';
import type { Annotation, Relationship } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Check, X, Stethoscope, ChevronLeft, ChevronRight } from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import { useDocumentSegments } from '../hooks/useDocumentSegments';
import { MEDICAL_LABELS, MEDICAL_ENTITIES } from '../constants/labels';
import { UI_CONSTANTS } from '../constants/ui';
import { ANNOTATION_STATUS } from '../constants/status';

interface Props {
  title?: string;
  text: string;
  annotations: Annotation[];
  relationships?: Relationship[];
  containerRef: RefObject<HTMLDivElement | null>;
  activeAnnotationId: string | null;
  onUpdate?: (id: string, updates: Partial<Annotation>) => void;
  leftCollapsed?: boolean;
  setLeftCollapsed?: (collapsed: boolean) => void;
  rightCollapsed?: boolean;
  setRightCollapsed?: (collapsed: boolean) => void;
}

export const DocumentViewer = memo(function DocumentViewer({ 
  title, 
  text, 
  annotations, 
  relationships = [],
  containerRef, 
  activeAnnotationId, 
  onUpdate,
  leftCollapsed,
  setLeftCollapsed,
  rightCollapsed,
  setRightCollapsed
}: Props) {
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const { segments } = useDocumentSegments({ text, annotations });

  const connectedAnnotationIds = new Set<string>();
  if (activeAnnotationId && relationships) {
    connectedAnnotationIds.add(activeAnnotationId);
    for (const rel of relationships) {
      if (rel.sourceAnnotationId === activeAnnotationId) {
        connectedAnnotationIds.add(rel.targetAnnotationId);
      } else if (rel.targetAnnotationId === activeAnnotationId) {
        connectedAnnotationIds.add(rel.sourceAnnotationId);
      }
    }
  }

  return (
    <StyledCard>
      <ViewerContent>
        <Header>
          <HeaderFlex>
            <LeftHeaderGroup>
              {setLeftCollapsed && (
                <SidebarToggleButton 
                  variant="ghost"
                  size="icon"
                  onClick={() => setLeftCollapsed(!leftCollapsed)}
                >
                  {leftCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </SidebarToggleButton>
              )}
              <div>
                <StyledTitle>{title || 'Patient Note'}</StyledTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    Live Review
                  </span>
                  <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-800" />
                  <Badge variant="info" className="gap-1 font-semibold text-[10px] px-1.5 py-0">
                    <Stethoscope className="h-3 w-3" /> EHR-V2
                  </Badge>
                </div>
              </div>
            </LeftHeaderGroup>
            
            <RightHeaderGroup>
              <InstructionText>Review clinical entities. Highlight text to add new annotations.</InstructionText>
              {setRightCollapsed && (
                <SidebarToggleButton 
                  variant="ghost"
                  size="icon"
                  onClick={() => setRightCollapsed(!rightCollapsed)}
                >
                  {rightCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </SidebarToggleButton>
              )}
            </RightHeaderGroup>
          </HeaderFlex>
        </Header>

        <DocumentBody ref={containerRef}>
          {segments.map((seg, idx) => {
            if (seg.type === 'text') {
              return <span key={`text-${idx}`}>{seg.content}</span>;
            }

            const ann = seg.annotation!;
            const isHovered = hoveredAnnotationId === ann.id;
            const isPulse = activeAnnotationId === ann.id;
            const isRejected = ann.status === ANNOTATION_STATUS.REJECTED;
            const isConnected = activeAnnotationId !== null && connectedAnnotationIds.has(ann.id) && activeAnnotationId !== ann.id;
            const isUnrelated = activeAnnotationId !== null && !connectedAnnotationIds.has(ann.id);

            const highlightElement = (
              <AnnotationHighlight
                id={`ann-${ann.id}`}
                $label={ann.label}
                $isHovered={isHovered}
                $isPulse={isPulse}
                $isRejected={isRejected}
                $assertion={ann.assertion}
                $isConnected={isConnected}
                $isUnrelated={isUnrelated}
                onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                onMouseLeave={() => setHoveredAnnotationId(null)}
              >
                {seg.content}
              </AnnotationHighlight>
            );

            if (ann.status === ANNOTATION_STATUS.SUGGESTED && onUpdate) {
              return (
                <Popover key={ann.id}>
                  <PopoverTrigger asChild>
                    {highlightElement}
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-3 flex flex-col gap-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase">{ann.label} Suggestion</h4>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1 gap-1 bg-emerald-500 hover:bg-emerald-600 text-white" 
                        onClick={() => onUpdate(ann.id, { status: ANNOTATION_STATUS.ACCEPTED })}
                      >
                        <Check className="h-3 w-3" /> Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        className="flex-1 gap-1" 
                        onClick={() => onUpdate(ann.id, { status: ANNOTATION_STATUS.REJECTED })}
                      >
                        <X className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }

            return <span key={ann.id}>{highlightElement}</span>;
          })}
        </DocumentBody>
      </ViewerContent>
    </StyledCard>
  );
});

// --- Styled Components ---

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
  100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
`;

const StyledCard = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  border: none;
  overflow-y: auto;
  padding: 16px;
  background: ${props => props.theme.colorBgContainer};
  
  @media (min-width: 576px) {
    padding: 24px;
  }
  @media (min-width: 768px) {
    padding: 40px;
  }

  @media (min-width: 992px) {
    border-radius: 16px;
    border: 1px solid ${props => props.theme.colorBorderSecondary};
    box-shadow: 0 8px 32px ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.02)'};
  }
`;

const ViewerContent = styled.div`
  max-width: ${UI_CONSTANTS.MAX_CONTENT_WIDTH};
  margin: 0 auto;
  width: 100%;
`;

const Header = styled.header`
  margin-bottom: 24px;
  border-bottom: 1px solid ${props => props.theme.colorBgBase === '#09090b' ? '#303030' : '#f0f0f0'};
  padding-bottom: 16px;
  
  @media (min-width: 768px) {
    margin-bottom: 40px;
    padding-bottom: 24px;
  }
`;

const HeaderFlex = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
  width: 100%;
  
  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`;

const LeftHeaderGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const RightHeaderGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  justify-content: space-between;
  
  @media (min-width: 768px) {
    width: auto;
    justify-content: flex-end;
  }
`;

const SidebarToggleButton = styled(Button)`
  display: none !important;
  
  @media (min-width: 992px) {
    display: flex !important;
    align-items: center;
    justify-content: center;
  }
`;

const DocumentBody = styled.div`
  font-family: ${props => props.theme.fontFamily};
  font-size: 16px;
  font-weight: 500;
  line-height: 1.6;
  color: ${props => props.theme.colorTextBase};
  
  @media (min-width: 768px) {
    font-size: 18px;
    line-height: 1.7;
  }
  @media (min-width: 992px) {
    font-size: 20px;
    line-height: 1.8;
  }
`;

const AnnotationHighlight = styled.mark<{
  $label: string;
  $isHovered: boolean;
  $isPulse: boolean;
  $isRejected: boolean;
  $assertion?: string;
  $isConnected?: boolean;
  $isUnrelated?: boolean;
}>`
  cursor: pointer;
  background: ${props => {
    if (props.$isRejected) return 'transparent';
    if (props.$assertion === 'negated') {
      return props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.05)' : '#e5e7eb';
    }
    const config = MEDICAL_LABELS[props.$label as keyof typeof MEDICAL_LABELS];
    const isDark = props.theme.colorBgBase === '#09090b';
    if (isDark) {
      return config ? `${config.border}26` : 'rgba(255, 255, 255, 0.08)'; // hex + 26 = 15% opacity
    }
    return config?.bg || '#f5f5f5';
  }};
  
  border-bottom: 2px ${props => props.$assertion === 'possible' ? 'dashed' : 'solid'} ${props => {
    if (props.$isRejected) return props.theme.colorError;
    if (props.$assertion === 'negated') return '#9ca3af';
    const config = MEDICAL_LABELS[props.$label as keyof typeof MEDICAL_LABELS];
    return config?.border || props.theme.colorTextSecondary;
  }};

  color: ${props => {
    if (props.$isPulse) return '#1e1b4b'; // Ensure high contrast dark text against light lavender bg
    if (props.$assertion === 'negated') {
      return props.theme.colorBgBase === '#09090b' ? '#a1a1aa' : '#6b7280';
    }
    const isDark = props.theme.colorBgBase === '#09090b';
    if (isDark) {
      return props.theme.colorTextBase || '#f4f4f5';
    }
    const label = props.$label;
    if (label === MEDICAL_ENTITIES.CONDITION) return '#006d75'; // Dark teal
    if (label === MEDICAL_ENTITIES.MEDICATION) return '#ad4e00'; // Dark orange/amber
    if (label === MEDICAL_ENTITIES.FINDING) return '#135200'; // Dark clinical green
    if (label === MEDICAL_ENTITIES.PROCEDURE) return '#10239e'; // Dark geekblue
    return props.theme.colorTextBase || '#000000';
  }};

  padding: 2px 6px;
  margin: 0 2px;
  transition: all ${UI_CONSTANTS.ANIMATION_SPEED} cubic-bezier(0.2, 0.8, 0.2, 1) ease;
  border-radius: 6px;
  text-decoration: ${props => (props.$isRejected || props.$assertion === 'negated') ? 'line-through' : 'none'};
  
  opacity: ${props => {
    if (props.$isUnrelated) return 0.25;
    if (props.$isRejected || props.$assertion === 'negated') return 0.6;
    return 1;
  }};

  filter: ${props => props.$isUnrelated ? 'blur(0.5px)' : 'none'};
  
  ${props => props.$isHovered && !props.$isRejected && css`
    background: ${() => {
      const config = MEDICAL_LABELS[props.$label as keyof typeof MEDICAL_LABELS];
      const isDark = props.theme.colorBgBase === '#09090b';
      if (isDark) {
        return config ? `${config.border}4d` : 'rgba(255, 255, 255, 0.15)'; // hex + 4d = 30% opacity
      }
      return config?.hover || '#e8e8e8';
    }};
    box-shadow: 0 4px 12px ${() => {
      const config = MEDICAL_LABELS[props.$label as keyof typeof MEDICAL_LABELS];
      return config ? `${config.border}33` : 'rgba(0,0,0,0.1)';
    }};
  `}

  ${props => props.$isPulse && css`
    animation: ${pulse} 2s infinite;
    background: #c7d2fe !important;
  `}

  ${props => props.$isConnected && css`
    box-shadow: 0 0 16px 2px #6366f1;
    border: 1.5px solid #6366f1 !important;
  `}
`;

const StyledTitle = styled.h3`
  margin: 0 0 4px 0;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-size: 20px;
  color: ${props => props.theme.colorTextBase};
  
  @media (min-width: 768px) {
    font-size: 24px;
  }
`;

const InstructionText = styled.span`
  font-size: 13px;
  display: none;
  color: ${props => props.theme.colorTextSecondary};
  
  @media (min-width: 768px) {
    display: inline;
    max-width: 300px;
    text-align: right;
  }
`;
