import { useState, useEffect } from 'react';
import type { Annotation } from '../types/annotation';
import type { Document } from '../types/document';
import { api } from '../api/annotations';
import { Button } from './ui/button';
import { toast } from './ui/toast';
import {
  ListFilterRow,
  SelectWrapper,
  FilterSectionLabel,
  FilterSelect,
  SearchInputWrapper,
  StyledInput,
  EmptyStateCard,
  TableContainer,
  ClinicalTable,
  TableRow,
  StyledTag,
} from './DocumentListView.styles';

interface Props {
  documents: Document[];
  onNavigateToDocument: (documentId: string) => void;
  onExportFhir: (annotations: Annotation[], doc: Document | { id: string }) => void;
}

export function CohortQueryTab({ documents, onNavigateToDocument, onExportFhir }: Props) {
  const [selectedLabel, setSelectedLabel] = useState<string>('all');
  const [selectedAssertion, setSelectedAssertion] = useState<string>('all');
  const [searchConceptCode, setSearchConceptCode] = useState<string>('');

  const [searchResults, setSearchResults] = useState<Annotation[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);

  useEffect(() => {
    const fetchSearchResults = async () => {
      const active =
        selectedLabel !== 'all' ||
        selectedAssertion !== 'all' ||
        searchConceptCode.trim() !== '';
      setIsFilterActive(active);

      if (!active) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await api.searchAnnotations({
          label: selectedLabel,
          assertion: selectedAssertion,
          conceptCode: searchConceptCode,
        });
        setSearchResults(results);
      } catch (err) {
        console.error('Failed to search annotations', err);
        toast.error('Search failed. Please try again.');
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchSearchResults, 300);
    return () => clearTimeout(timer);
  }, [selectedLabel, selectedAssertion, searchConceptCode]);

  return (
    <>
      <ListFilterRow style={{ alignItems: 'flex-end' }}>
        <SelectWrapper>
          <FilterSectionLabel>MEDICAL CATEGORY</FilterSectionLabel>
          <FilterSelect
            value={selectedLabel}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedLabel(e.target.value)
            }
          >
            <option value="all">All Categories</option>
            <option value="Clinical Condition">Clinical Condition (ICD-10)</option>
            <option value="Medication Statement">Medication (RxNorm)</option>
            <option value="Clinical Finding">Clinical Finding (SNOMED)</option>
            <option value="Medical Procedure">Procedure (CPT)</option>
          </FilterSelect>
        </SelectWrapper>

        <SelectWrapper>
          <FilterSectionLabel>ASSERTION STATUS</FilterSectionLabel>
          <FilterSelect
            value={selectedAssertion}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedAssertion(e.target.value)
            }
          >
            <option value="all">All Assertions</option>
            <option value="positive">Positive (Confirmed)</option>
            <option value="negated">Negated (Ruled Out)</option>
            <option value="possible">Possible (Suspected)</option>
          </FilterSelect>
        </SelectWrapper>

        <SearchInputWrapper>
          <FilterSectionLabel>CONCEPT CODE SEARCH</FilterSectionLabel>
          <StyledInput
            placeholder="e.g. E11.9, J20.9"
            value={searchConceptCode}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchConceptCode(e.target.value)
            }
          />
        </SearchInputWrapper>

        {(selectedLabel !== 'all' ||
          selectedAssertion !== 'all' ||
          searchConceptCode !== '') && (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive/80 font-semibold text-xs h-9 px-3 self-end mb-[2px]"
            onClick={() => {
              setSelectedLabel('all');
              setSelectedAssertion('all');
              setSearchConceptCode('');
            }}
          >
            Clear Filters
          </Button>
        )}
      </ListFilterRow>

      {isSearching ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Searching index records...</span>
          </div>
        </div>
      ) : isFilterActive ? (
        searchResults.length === 0 ? (
          <EmptyStateCard>
            <span className="text-sm text-muted-foreground">
              No clinical records match the selected GSI query filter.
            </span>
          </EmptyStateCard>
        ) : (
          <>
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 dark:border-indigo-500/20 flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span>
                  Showing Matched Cohort: <strong>{searchResults.length} concepts</strong> match GSI
                  filters.
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span>
                  Avg Confidence:{' '}
                  <strong>
                    {Math.round(
                      (searchResults.reduce((acc, curr) => acc + (curr.confidence || 1), 0) /
                        searchResults.length) *
                        100
                    )}
                    %
                  </strong>
                </span>
                <button
                  onClick={() => {
                    setSelectedLabel('all');
                    setSelectedAssertion('all');
                    setSearchConceptCode('');
                  }}
                  className="text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300 font-bold underline bg-transparent border-0 cursor-pointer p-0"
                >
                  Reset Search
                </button>
              </div>
            </div>
            <TableContainer>
              <ClinicalTable>
                <thead>
                  <tr>
                    <th>Doc ID</th>
                    <th>Clinical Term</th>
                    <th>Concept Code</th>
                    <th>Medical Category</th>
                    <th>Assertion</th>
                    <th>Confidence</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((ann) => {
                    const matchedDoc = documents.find((d) => d.id === ann.documentId);

                    let assertionColor = 'success';
                    if (ann.assertion === 'negated') assertionColor = 'error';
                    else if (ann.assertion === 'possible') assertionColor = 'warning';

                    const confidenceVal = ann.confidence
                      ? `${Math.round(ann.confidence * 100)}%`
                      : 'N/A';

                    return (
                      <TableRow
                        key={ann.id}
                        onClick={() => onNavigateToDocument(ann.documentId)}
                      >
                        <td className="doc-id-cell" style={{ whiteSpace: 'nowrap' }}>
                          <span className="font-mono font-bold tracking-tight text-inherit">
                            {ann.documentId}
                          </span>
                        </td>
                        <td className="doc-title-cell">
                          <span className="font-semibold text-[14px]">{ann.text}</span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className="snippet-code">{ann.conceptCode || 'No Code'}</span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <StyledTag>{ann.label || 'General Practice'}</StyledTag>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <StyledTag
                            color={assertionColor}
                            style={{ fontSize: 9, padding: '1px 8px', borderRadius: 12 }}
                          >
                            {(ann.assertion || 'positive').toUpperCase()}
                          </StyledTag>
                        </td>
                        <td style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {confidenceVal}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onNavigateToDocument(ann.documentId)}
                              className="h-8 text-xs font-semibold"
                            >
                              Review
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                onExportFhir([ann], matchedDoc || { id: ann.documentId });
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold"
                            >
                              Export FHIR
                            </Button>
                          </div>
                        </td>
                      </TableRow>
                    );
                  })}
                </tbody>
              </ClinicalTable>
            </TableContainer>
          </>
        )
      ) : (
        <EmptyStateCard>
          <span className="text-sm text-muted-foreground">
            Configure the GSI query filters above to search the global cohort index.
          </span>
        </EmptyStateCard>
      )}
    </>
  );
}
