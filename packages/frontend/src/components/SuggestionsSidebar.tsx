import { useState } from 'react';
import type { Annotation } from '../types/annotation';
import type { Relationship } from '../types/relationship';
import { AnnotationChip } from './AnnotationChip';
import { Button } from './ui/button';
import { ArrowLeft, Tags, Inbox, Link2, Trash2, PlusCircle } from 'lucide-react';
import styled from 'styled-components';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';

interface Props {
  annotations: Annotation[];
  onUpdate: (id: string, updates: Partial<Annotation>) => void;
  onChipClick: (id: string) => void;
  onBack: () => void;
  showBackButton?: boolean;
  relationships?: Relationship[];
  onCreateRelationship?: (sourceId: string, targetId: string, type: string) => void;
  onDeleteRelationship?: (relationshipId: string) => void;
}

export function SuggestionsSidebar({
  annotations,
  onUpdate,
  onChipClick,
  onBack,
  showBackButton = true,
  relationships = [],
  onCreateRelationship,
  onDeleteRelationship,
}: Props) {
  const [activeTab, setActiveTab] = useState<'annotations' | 'relationships'>('annotations');

  // Manual relationship linker state
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [relationType, setRelationType] = useState('associated_with');

  // Filter annotations to only those that are accepted/suggested/corrected (not rejected)
  const validAnnotations = annotations.filter(ann => ann.status !== 'rejected');

  // Filter relationships to only those where both source and target annotations are valid and exist
  const validRelationships = relationships.filter(rel => {
    const sourceAnn = validAnnotations.find(a => a.id === rel.sourceAnnotationId);
    const targetAnn = validAnnotations.find(a => a.id === rel.targetAnnotationId);
    return !!(sourceAnn && targetAnn);
  });

  const handleCreateRelation = () => {
    if (!sourceId || !targetId || !relationType) return;
    if (sourceId === targetId) return;
    
    onCreateRelationship?.(sourceId, targetId, relationType);
    
    // Reset selection state
    setSourceId('');
    setTargetId('');
  };

  return (
    <SidebarContainer>
      {showBackButton && (
        <BackButtonWrapper>
          <Button 
            variant="ghost"
            onClick={onBack}
            className="w-full justify-start gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Documents
          </Button>
        </BackButtonWrapper>
      )}

      {/* Tabs Header */}
      <TabsHeader>
        <TabButton 
          $active={activeTab === 'annotations'} 
          onClick={() => setActiveTab('annotations')}
        >
          <Tags className="h-3.5 w-3.5" />
          Annotations
        </TabButton>
        <TabButton 
          $active={activeTab === 'relationships'} 
          onClick={() => setActiveTab('relationships')}
        >
          <Link2 className="h-3.5 w-3.5" />
          Relationships
        </TabButton>
      </TabsHeader>

      <ContentWrapper>
        {activeTab === 'annotations' ? (
          <>
            <HeaderSection>
              <div className="flex items-center gap-2">
                <StyledTagsIcon />
                <HeaderText>Clinical Entities</HeaderText>
              </div>
              <CountText>{validAnnotations.length}</CountText>
            </HeaderSection>

            <ChipList>
              {validAnnotations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
                  <Inbox className="h-8 w-8 stroke-1" />
                  <span className="text-sm font-medium">No entities yet</span>
                </div>
              ) : (
                [...validAnnotations]
                  .sort((a, b) => a.startOffset - b.startOffset)
                  .map((ann) => (
                    <ChipWrapper key={ann.id}>
                      <AnnotationChip
                        annotation={ann}
                        onUpdate={(updates) => onUpdate(ann.id, updates)}
                        onClick={() => onChipClick(ann.id)}
                      />
                    </ChipWrapper>
                  ))
              )}
            </ChipList>
          </>
        ) : (
          <>
            <HeaderSection>
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-indigo-500" />
                <HeaderText>Semantic Relations</HeaderText>
              </div>
              <CountText>{validRelationships.length}</CountText>
            </HeaderSection>

            <RelationshipsScrollContainer>
              {/* Manual Linker Tool */}
              <ManualLinkerCard>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <PlusCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Manual Link Creator
                </div>
                
                <div className="flex flex-col gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">SOURCE ENTITY</label>
                    <StyledSelect 
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                    >
                      <option value="">-- Choose Head Entity --</option>
                      {validAnnotations.map((ann) => (
                        <option key={ann.id} value={ann.id}>
                          {ann.text} ({ann.label})
                        </option>
                      ))}
                    </StyledSelect>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">RELATIONSHIP TYPE</label>
                    <StyledSelect 
                      value={relationType}
                      onChange={(e) => setRelationType(e.target.value)}
                    >
                      <option value="treatment_for">treatment_for</option>
                      <option value="contraindicated_with">contraindicated_with</option>
                      <option value="associated_with">associated_with</option>
                      <option value="relates_to">relates_to</option>
                    </StyledSelect>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">TARGET ENTITY</label>
                    <StyledSelect 
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                    >
                      <option value="">-- Choose Tail Entity --</option>
                      {validAnnotations.map((ann) => (
                        <option key={ann.id} value={ann.id}>
                          {ann.text} ({ann.label})
                        </option>
                      ))}
                    </StyledSelect>
                  </div>

                  <Button 
                    variant="default"
                    size="sm"
                    className="w-full mt-1.5 font-semibold text-xs shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={!sourceId || !targetId || sourceId === targetId}
                    onClick={handleCreateRelation}
                  >
                    Link Entities
                  </Button>
                </div>
              </ManualLinkerCard>

              {/* Relationship List */}
              <TooltipProvider delayDuration={150}>
                <div className="mt-4 flex flex-col gap-3">
                  {validRelationships.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-3">
                      <Link2 className="h-8 w-8 stroke-1 text-muted-foreground/50 animate-pulse" />
                      <span className="text-xs font-semibold">No semantic relations linked yet</span>
                    </div>
                  ) : (
                    validRelationships.map((rel) => {
                      const sourceAnn = validAnnotations.find(a => a.id === rel.sourceAnnotationId)!;
                      const targetAnn = validAnnotations.find(a => a.id === rel.targetAnnotationId)!;

                      return (
                        <RelationCard key={rel.relationshipId}>
                          <RelationInfo>
                            <RelationRow>
                              <SourceEntityWrapper>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <EntitySpan $type={sourceAnn.label}>
                                      {sourceAnn.text}
                                    </EntitySpan>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="end" className="p-2 border bg-popover text-popover-foreground rounded-lg shadow-lg">
                                    <div className="flex flex-col gap-0.5 max-w-[220px]">
                                      <span className="font-bold text-[9px] uppercase text-zinc-400 tracking-wider">{sourceAnn.label}</span>
                                      <span className="font-semibold text-xs leading-normal">{sourceAnn.text}</span>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </SourceEntityWrapper>
                              
                              <RelationLinkWrapper>
                                <RelationBadge $type={rel.relationType}>{rel.relationType.replace('_', ' ')}</RelationBadge>
                                <RelationArrowLine />
                              </RelationLinkWrapper>

                              <TargetEntityWrapper>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <EntitySpan $type={targetAnn.label}>
                                      {targetAnn.text}
                                    </EntitySpan>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="start" className="p-2 border bg-popover text-popover-foreground rounded-lg shadow-lg">
                                    <div className="flex flex-col gap-0.5 max-w-[220px]">
                                      <span className="font-bold text-[9px] uppercase text-zinc-400 tracking-wider">{targetAnn.label}</span>
                                      <span className="font-semibold text-xs leading-normal">{targetAnn.text}</span>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TargetEntityWrapper>
                            </RelationRow>

                            {rel.confidence && (
                              <ConfidenceRow>
                                <ConfidenceDot $value={rel.confidence} />
                                Confidence: {Math.round(rel.confidence * 100)}%
                              </ConfidenceRow>
                            )}
                          </RelationInfo>
                          
                          <DeleteButton 
                            onClick={() => onDeleteRelationship?.(rel.relationshipId)}
                            title="Delete link"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </DeleteButton>
                        </RelationCard>
                      );
                    })
                  )}
                </div>
              </TooltipProvider>
            </RelationshipsScrollContainer>
          </>
        )}
      </ContentWrapper>
    </SidebarContainer>
  );
}

// --- Styled Components ---

const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(24, 24, 27, 0.7)' : 'rgba(255, 255, 255, 0.8)'} !important;
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.04)'};
`;

const BackButtonWrapper = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid ${props => props.theme.colorBorderSecondary};
`;

const TabsHeader = styled.div`
  display: flex;
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'};
  border-bottom: 1px solid ${props => props.theme.colorBorderSecondary};
  padding: 4px;
  gap: 4px;
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  background: ${props => props.$active ? (props.theme.colorBgBase === '#09090b' ? '#312e81' : '#e0e7ff') : 'transparent'};
  color: ${props => props.$active ? (props.theme.colorBgBase === '#09090b' ? '#e0e7ff' : '#4338ca') : props.theme.colorTextSecondary};

  &:hover {
    background: ${props => props.$active ? '' : (props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)')};
  }
`;

const ContentWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const HeaderSection = styled.div`
  padding: 14px 20px;
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'};
  border-bottom: 1px solid ${props => props.theme.colorBorderSecondary};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HeaderText = styled.span`
  font-size: 11px;
  color: ${props => props.theme.colorTextSecondary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
`;

const ChipList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const RelationshipsScrollContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const StyledTagsIcon = styled(Tags)`
  color: ${props => props.theme.colorPrimary};
  width: 16px;
  height: 16px;
`;

const CountText = styled.span`
  font-weight: 600;
  color: ${props => props.theme.colorTextBase};
  font-size: 13px;
`;

const ChipWrapper = styled.div`
  margin-bottom: 12px;
`;

const ManualLinkerCard = styled.div`
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.5)'};
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  border-left: 3px solid #6366f1;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 4px 12px ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.01)'};
  backdrop-filter: blur(8px);
`;

const StyledSelect = styled.select`
  width: 100%;
  background: ${props => props.theme.colorBgBase === '#09090b' ? '#18181b' : '#ffffff'};
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  color: ${props => props.theme.colorTextBase};
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:focus {
    border-color: ${props => props.theme.colorPrimary};
  }
`;

const RelationCard = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.5)'};
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  border-radius: 12px;
  padding: 14px 10px;
  gap: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(8px);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(99, 102, 241, 0.06)'};
    border-color: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'};
  }
`;

const RelationInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const RelationRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
`;

const SourceEntityWrapper = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-end;
`;

const TargetEntityWrapper = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-start;
`;

const RelationLinkWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 90px;
  flex-shrink: 0;
  position: relative;
  padding: 0 4px;
`;

const RelationArrowLine = styled.div`
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent, 
    ${props => props.theme.colorTextSecondary}44 20%, 
    ${props => props.theme.colorTextSecondary}44 80%, 
    transparent
  );
  margin-top: 4px;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    right: 8px;
    top: -2.5px;
    width: 5px;
    height: 5px;
    border-top: 1px solid ${props => props.theme.colorTextSecondary}aa;
    border-right: 1px solid ${props => props.theme.colorTextSecondary}aa;
    transform: rotate(45deg);
  }
`;

const RelationBadge = styled.span<{ $type: string }>`
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 1.5px 5px;
  border-radius: 5px;
  letter-spacing: 0.05em;
  white-space: nowrap;
  border: 1px solid transparent;
  text-align: center;

  ${props => {
    switch (props.$type) {
      case 'treatment_for':
        return 'color: #10b981; background: rgba(16, 185, 129, 0.06); border-color: rgba(16, 185, 129, 0.15);';
      case 'contraindicated_with':
        return 'color: #ef4444; background: rgba(239, 68, 68, 0.06); border-color: rgba(239, 68, 68, 0.15);';
      case 'associated_with':
        return 'color: #6366f1; background: rgba(99, 102, 241, 0.06); border-color: rgba(99, 102, 241, 0.15);';
      default:
        return 'color: #8b5cf6; background: rgba(139, 92, 246, 0.06); border-color: rgba(139, 92, 246, 0.15);';
    }
  }}
`;

const ConfidenceRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 8.5px;
  color: ${props => props.theme.colorTextSecondary};
  font-weight: 500;
  margin-top: 6px;
  opacity: 0.8;
`;

const ConfidenceDot = styled.div<{ $value: number }>`
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: ${props => props.$value > 0.8 ? '#10b981' : props.$value > 0.5 ? '#f59e0b' : '#ef4444'};
`;

const EntitySpan = styled.span<{ $type: string }>`
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  width: fit-content;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  
  ${props => {
    switch (props.$type) {
      case 'Clinical Condition':
        return 'background: rgba(19, 194, 194, 0.08); color: #13c2c2; border: 1px solid rgba(19, 194, 194, 0.2);';
      case 'Medication Statement':
        return 'background: rgba(250, 140, 22, 0.08); color: #fa8c16; border: 1px solid rgba(250, 140, 22, 0.2);';
      case 'Clinical Finding':
        return 'background: rgba(82, 196, 26, 0.08); color: #52c41a; border: 1px solid rgba(82, 196, 26, 0.2);';
      case 'Medical Procedure':
        return 'background: rgba(47, 84, 235, 0.08); color: #2f54eb; border: 1px solid rgba(47, 84, 235, 0.2);';
      default:
        return 'background: rgba(156, 163, 175, 0.08); color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.2);';
    }
  }}
`;

const DeleteButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme.colorTextSecondary};
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'};
    color: #ef4444;
  }
`;
