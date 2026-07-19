import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocuments } from '../hooks/queries/useDocuments';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from './ui/toast';
import { FileText, Sparkles } from 'lucide-react';
import { generateFhirResource } from '../lib/fhir';
import { DocumentBrowseTab } from './DocumentBrowseTab';
import { CohortQueryTab } from './CohortQueryTab';
import type { Annotation } from '../types/annotation';
import type { Document } from '../types/document';
import {
  LoadingContainer,
  StyledLayout,
  StyledHeader,
  StyledContent,
  ContentWrapper,
  LayoutRow,
  ViewTabs,
  TabButton,
  StyledLogoIcon,
  StyledBrandTitle,
  ListFilterRow,
  SearchInputWrapper,
  StyledInput,
  SelectWrapper,
  FilterSelect,
  SegmentedWrapper,
  StatusFilterButton,
} from './DocumentListView.styles';

interface Props {
  onSelectDocument: (id: string) => void;
}

export function DocumentListView({ onSelectDocument }: Props) {
  const navigate = useNavigate();
  const { data: documents = [], isLoading } = useDocuments();

  const [activeTab, setActiveTab] = useState<'browse' | 'cohort'>('browse');

  const [docSearchText, setDocSearchText] = useState<string>('');
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('all');
  const [docStatusFilter, setDocStatusFilter] = useState<string>('all');

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.id.toLowerCase().includes(docSearchText.toLowerCase()) ||
      (doc.title && doc.title.toLowerCase().includes(docSearchText.toLowerCase()));

    const matchesCategory =
      docCategoryFilter === 'all' ||
      (doc.category && doc.category.toLowerCase() === docCategoryFilter.toLowerCase());

    const matchesStatus = docStatusFilter === 'all' || doc.status === docStatusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const [isFhirModalOpen, setIsFhirModalOpen] = useState(false);
  const [fhirData, setFhirData] = useState<string>('');

  const handleExportFhir = (annotations: Annotation[], doc: Document | { id: string }) => {
    const fhir = generateFhirResource(doc, annotations);
    setFhirData(JSON.stringify(fhir, null, 2));
    setIsFhirModalOpen(true);
  };

  if (isLoading) {
    return (
      <LoadingContainer>
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-semibold text-muted-foreground">
            Loading clinical notes...
          </span>
        </div>
      </LoadingContainer>
    );
  }

  return (
    <StyledLayout>
      <StyledHeader>
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-3">
            <StyledLogoIcon />
            <StyledBrandTitle>EHR Clinical Hub</StyledBrandTitle>
          </div>
        </div>
      </StyledHeader>

      <StyledContent>
        <ContentWrapper>
          <LayoutRow>
            {/* View Tabs */}
            <ViewTabs>
              <TabButton $active={activeTab === 'browse'} onClick={() => setActiveTab('browse')}>
                <FileText className="h-4 w-4" />
                Browse Documents
              </TabButton>
              <TabButton $active={activeTab === 'cohort'} onClick={() => setActiveTab('cohort')}>
                <Sparkles className="h-4 w-4" />
                Cohort Queries
              </TabButton>
            </ViewTabs>

            {activeTab === 'browse' ? (
              <>
                <ListFilterRow>
                  <SearchInputWrapper>
                    <StyledInput
                      placeholder="Search patient notes by title or ID..."
                      value={docSearchText}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDocSearchText(e.target.value)
                      }
                    />
                  </SearchInputWrapper>
                  <SelectWrapper>
                    <FilterSelect
                      value={docCategoryFilter}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setDocCategoryFilter(e.target.value)
                      }
                    >
                      <option value="all">All Categories</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Endocrinology">Endocrinology</option>
                      <option value="Pulmonology">Pulmonology</option>
                      <option value="Neurology">Neurology</option>
                      <option value="General Practice">General Practice</option>
                      <option value="Cardiac">Cardiac</option>
                    </FilterSelect>
                  </SelectWrapper>
                  <SegmentedWrapper>
                    <StatusFilterButton
                      $active={docStatusFilter === 'all'}
                      onClick={() => setDocStatusFilter('all')}
                    >
                      All
                    </StatusFilterButton>
                    <StatusFilterButton
                      $active={docStatusFilter === 'ready_for_review'}
                      onClick={() => setDocStatusFilter('ready_for_review')}
                    >
                      Ready
                    </StatusFilterButton>
                    <StatusFilterButton
                      $active={docStatusFilter === 'in_progress'}
                      onClick={() => setDocStatusFilter('in_progress')}
                    >
                      In Progress
                    </StatusFilterButton>
                    <StatusFilterButton
                      $active={docStatusFilter === 'reviewed'}
                      onClick={() => setDocStatusFilter('reviewed')}
                    >
                      Reviewed
                    </StatusFilterButton>
                  </SegmentedWrapper>
                </ListFilterRow>

                <DocumentBrowseTab
                  filteredDocuments={filteredDocuments}
                  onSelectDocument={onSelectDocument}
                />
              </>
            ) : (
              <CohortQueryTab
                documents={documents}
                onNavigateToDocument={(id) => navigate(`/document/${id}`)}
                onExportFhir={handleExportFhir}
              />
            )}
          </LayoutRow>
        </ContentWrapper>
      </StyledContent>

      {/* FHIR Export Modal */}
      <Dialog open={isFhirModalOpen} onOpenChange={setIsFhirModalOpen}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">FHIR Bundle JSON Export</DialogTitle>
          </DialogHeader>
          <div className="my-2">
            <span className="text-xs text-muted-foreground block">
              Standard FHIR Bundle resources conforming to US Core Condition and MedicationStatement
              profiles.
            </span>
          </div>
          <pre
            style={{
              background: '#09090b',
              color: '#34d399',
              padding: 16,
              borderRadius: 12,
              maxHeight: 400,
              overflowY: 'auto',
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          >
            {fhirData}
          </pre>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setIsFhirModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                navigator.clipboard.writeText(fhirData);
                toast.success('FHIR Bundle copied to clipboard!');
                setIsFhirModalOpen(false);
              }}
            >
              Copy to Clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StyledLayout>
  );
}
