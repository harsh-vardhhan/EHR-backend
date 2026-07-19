import { useRef, useState } from 'react';
import type { Annotation, Label, Relationship } from '../types';
import { useDocument } from '../hooks/queries/useDocuments';
import { useAnnotations } from '../hooks/queries/useAnnotations';
import { useRelationships } from '../hooks/queries/useRelationships';
import { useTextSelection } from '../hooks/useTextSelection';
import { DocumentViewer } from './DocumentViewer';
import { LabelPicker } from './LabelPicker';
import { SuggestionsSidebar } from './SuggestionsSidebar';
import { SessionMetrics } from './SessionMetrics';
import { ErrorBoundary } from './ErrorBoundary';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { ArrowLeft, BarChart3, AlertTriangle, Shield } from 'lucide-react';
import styled from 'styled-components';
import { AuditTrailPanel } from './AuditTrailPanel';

interface Props {
  documentId: string;
  onBack: () => void;
}

export function DocumentReviewView({ documentId, onBack }: Props) {
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'metrics' | 'audit'>('metrics');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { selection, setSelection } = useTextSelection(containerRef);

  const { data: serverDocument, isError, error } = useDocument(documentId);
  const { 
    createAnnotation: serverCreateAnnotation, 
    updateAnnotation: serverUpdateAnnotation 
  } = useAnnotations(documentId);

  const {
    createRelationship: serverCreateRelationship,
    deleteRelationship: serverDeleteRelationship
  } = useRelationships(documentId);

  const document = serverDocument;

  const annotations = document?.annotations || [];
  const relationships: Relationship[] = document?.relationships || [];

  const handleSelectLabel = (label: Label) => {
    if (!selection || !document) return;

    serverCreateAnnotation({
      documentId: document.id,
      text: selection.text,
      label,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      source: 'human',
      status: 'accepted',
      assertion: 'positive',
    });

    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleUpdateAnnotation = (id: string, updates: Partial<Annotation>) => {
    serverUpdateAnnotation({ id, updates });
  };

  const handleChipClick = (id: string) => {
    setActiveAnnotationId(id);
    const element = window.document.getElementById(`ann-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setActiveAnnotationId(null), 2000);
    if (mobileDrawerVisible) setMobileDrawerVisible(false);
  };

  if (isError) {
    return (
      <LoadingContainer>
        <div className="flex flex-col items-center justify-center text-center p-8 max-w-md bg-card rounded-xl border border-border shadow-lg">
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-full">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold mb-2">Document Not Found</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {error?.message || "The clinical note you are trying to view does not exist or could not be loaded."}
          </p>
          <Button variant="default" onClick={onBack}>
            Back to Documents
          </Button>
        </div>
      </LoadingContainer>
    );
  }

  if (!document || !document.text) {
    return (
      <LoadingContainer>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <LoadingTitle>Loading clinical note...</LoadingTitle>
      </LoadingContainer>
    );
  }

  return (
    <ErrorBoundary>
      <MainLayout>
        {/* Left Sider: Annotations */}
        <SidebarContainer $collapsed={leftCollapsed}>
          <SuggestionsSidebar
            annotations={annotations}
            onUpdate={handleUpdateAnnotation}
            onChipClick={handleChipClick}
            onBack={onBack}
            relationships={relationships}
            onCreateRelationship={(sourceId, targetId, type) =>
              serverCreateRelationship({
                documentId,
                sourceAnnotationId: sourceId,
                targetAnnotationId: targetId,
                relationType: type,
              })
            }
            onDeleteRelationship={(relId) => serverDeleteRelationship({ id: relId })}
          />
        </SidebarContainer>

        <MiddleContainer>
          {/* Mobile Header */}
          <MobileHeader>
            <Button variant="outline" className="gap-2 h-9" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button 
              variant="default" 
              className="gap-2 h-9"
              onClick={() => setMobileDrawerVisible(true)}
            >
              <BarChart3 className="h-4 w-4" /> Metrics
            </Button>
          </MobileHeader>

          <MainContent>
            <ControlBar>
              <ControlLeftGroup>
                <ShieldIconActive />
                <ControlText>HIPAA Data Protection Shield</ControlText>
              </ControlLeftGroup>

            </ControlBar>

            <DocumentViewer
              title={document.title || document.id}
              text={document.text}
              annotations={annotations}
              relationships={relationships}
              containerRef={containerRef}
              activeAnnotationId={activeAnnotationId}
              onUpdate={handleUpdateAnnotation}
              leftCollapsed={leftCollapsed}
              setLeftCollapsed={setLeftCollapsed}
              rightCollapsed={rightCollapsed}
              setRightCollapsed={setRightCollapsed}
            />
            
            {selection?.position && (
              <LabelPicker
                position={selection.position}
                onSelect={handleSelectLabel}
                onClose={() => setSelection(null)}
              />
            )}

            {/* Mobile Drawer for Metrics/Sidebar */}
            <Drawer open={mobileDrawerVisible} onOpenChange={setMobileDrawerVisible}>
              <DrawerContent side="right" className="p-0 flex flex-col h-full w-full sm:max-w-md">
                <DrawerHeader className="p-4 border-b">
                  <DrawerTitle>Review Summary</DrawerTitle>
                </DrawerHeader>
                <div className="flex-1 overflow-hidden p-4">
                  <Tabs defaultValue="1" className="h-full flex flex-col">
                    <TabsList className="grid grid-cols-2 mb-4 w-full">
                      <TabsTrigger value="1">Annotations</TabsTrigger>
                      <TabsTrigger value="2">Metrics</TabsTrigger>
                    </TabsList>
                    <TabsContent value="1" className="flex-1 overflow-hidden">
                      <TabContentWrapper>
                        <SuggestionsSidebar
                          annotations={annotations}
                          onUpdate={handleUpdateAnnotation}
                          onChipClick={handleChipClick}
                          onBack={onBack}
                          showBackButton={false}
                          relationships={relationships}
                          onCreateRelationship={(sourceId, targetId, type) =>
                            serverCreateRelationship({
                              documentId,
                              sourceAnnotationId: sourceId,
                              targetAnnotationId: targetId,
                              relationType: type,
                            })
                          }
                          onDeleteRelationship={(relId) => serverDeleteRelationship({ id: relId })}
                        />
                      </TabContentWrapper>
                    </TabsContent>
                    <TabsContent value="2" className="flex-1 overflow-y-auto">
                      <TabContentWrapper>
                        <SessionMetrics annotations={annotations} />
                      </TabContentWrapper>
                    </TabsContent>
                  </Tabs>
                </div>
              </DrawerContent>
            </Drawer>
          </MainContent>
        </MiddleContainer>

        {/* Right Sider: Session Metrics & Audit Trail */}
        <RightSidebarContainer $collapsed={rightCollapsed}>
          <SidebarTabsContainer>
            <TabHeader>
              <TabButton 
                $active={activeRightTab === 'metrics'} 
                onClick={() => setActiveRightTab('metrics')}
              >
                Metrics
              </TabButton>
              <TabButton 
                $active={activeRightTab === 'audit'} 
                onClick={() => {
                  setActiveRightTab('audit');
                  if (rightCollapsed && setRightCollapsed) setRightCollapsed(false);
                }}
              >
                Audit Log
              </TabButton>
            </TabHeader>
            <TabContent>
              {activeRightTab === 'metrics' ? (
                <SessionMetrics annotations={annotations} />
              ) : (
                <AuditTrailPanel documentId={document.id} />
              )}
            </TabContent>
          </SidebarTabsContainer>
        </RightSidebarContainer>
      </MainLayout>
    </ErrorBoundary>
  );
}

// --- Styled Components ---

const MainLayout = styled.div`
  height: 100vh;
  overflow: hidden;
  background: ${props => props.theme.colorBgLayout};
  display: flex;
  width: 100%;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: ${props => props.theme.colorBgLayout};
  width: 100%;
`;

const SidebarContainer = styled.div<{ $collapsed: boolean }>`
  width: ${props => props.$collapsed ? '0px' : '300px'};
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: ${props => props.$collapsed ? '0' : '12px 6px 12px 12px'};
  flex-shrink: 0;
  
  @media (max-width: 991px) {
    display: none;
  }
`;

const RightSidebarContainer = styled.div<{ $collapsed: boolean }>`
  width: ${props => props.$collapsed ? '0px' : '280px'};
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: ${props => props.$collapsed ? '0' : '12px 12px 12px 6px'};
  flex-shrink: 0;

  @media (max-width: 991px) {
    display: none;
  }
`;

const MiddleContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
`;

const MobileHeader = styled.div`
  background: ${props => props.theme.colorBgContainer};
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${props => props.theme.colorBgBase === '#09090b' ? '#303030' : '#f0f0f0'};
  height: 64px;
  line-height: 64px;
  flex-shrink: 0;

  @media (min-width: 992px) {
    display: none !important;
  }
`;

const MainContent = styled.div`
  position: relative;
  background: transparent;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  
  @media (min-width: 992px) {
    padding: 12px;
  }
`;

const TabContentWrapper = styled.div`
  height: 100%;
  overflow-y: auto;
`;

const LoadingTitle = styled.h5`
  margin-top: 16px;
  font-weight: 600;
  color: ${props => props.theme.colorTextBase};
`;

const ControlBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;
  margin-bottom: 12px;
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(24, 24, 27, 0.4)' : 'rgba(255, 255, 255, 0.5)'};
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  border-radius: 12px;
  backdrop-filter: blur(12px);
`;

const ControlLeftGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ShieldIconActive = styled(Shield)`
  color: #10b981;
  width: 16px;
  height: 16px;
  fill: rgba(16, 185, 129, 0.1);
`;

const ControlText = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colorText};
`;



const SidebarTabsContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const TabHeader = styled.div`
  display: flex;
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'};
  border: 1px solid ${props => props.theme.colorBorderSecondary};
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 12px;
  width: 100%;
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: ${props => props.$active ? (props.theme.colorBgBase === '#09090b' ? '#27272a' : '#ffffff') : 'transparent'};
  color: ${props => props.$active ? props.theme.colorText : props.theme.colorTextSecondary};
  box-shadow: ${props => props.$active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};
  transition: all 0.2s ease;
  
  &:hover {
    color: ${props => props.theme.colorText};
  }
`;

const TabContent = styled.div`
  flex: 1;
  overflow: hidden;
`;
