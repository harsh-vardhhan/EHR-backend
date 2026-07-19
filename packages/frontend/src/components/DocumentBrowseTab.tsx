import type { Document } from '../types';
import { Button } from './ui/button';
import {
  TableContainer,
  ClinicalTable,
  TableRow,
  StyledTag,
} from './DocumentListView.styles';

interface Props {
  filteredDocuments: Document[];
  onSelectDocument: (id: string) => void;
}

export function DocumentBrowseTab({ filteredDocuments, onSelectDocument }: Props) {
  return (
    <TableContainer>
      <ClinicalTable>
        <thead>
          <tr>
            <th>ID</th>
            <th>Note Details / Title</th>
            <th>Medical Category</th>
            <th>Created Date</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredDocuments.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0' }}>
                <span className="text-sm text-muted-foreground">
                  No clinical documents match the active filter criteria.
                </span>
              </td>
            </tr>
          ) : (
            filteredDocuments.map((doc) => {
              let statusColor = 'blue';
              let statusLabel = 'Ready';
              let actionText = 'Review';

              if (doc.status === 'in_progress') {
                statusColor = 'orange';
                statusLabel = 'In Progress';
                actionText = 'Resume';
              } else if (doc.status === 'reviewed') {
                statusColor = 'success';
                statusLabel = 'Reviewed';
                actionText = 'View';
              }

              const formattedDate = doc.createdAt
                ? new Date(doc.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'N/A';

              return (
                <TableRow key={doc.id} onClick={() => onSelectDocument(doc.id)}>
                  <td className="doc-id-cell">
                    <span className="font-mono font-bold tracking-tight text-inherit">
                      {doc.id}
                    </span>
                  </td>
                  <td className="doc-title-cell">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="font-semibold text-[14px]">
                        {doc.title || `Note ${doc.id}`}
                      </span>
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <StyledTag color={statusColor}>
                      {doc.category || 'General Practice'}
                    </StyledTag>
                  </td>
                  <td style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                    {formattedDate}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          doc.status === 'reviewed'
                            ? 'bg-emerald-500'
                            : doc.status === 'in_progress'
                              ? 'bg-amber-500 animate-pulse'
                              : 'bg-blue-500 animate-pulse'
                        }`}
                      />
                      {statusLabel}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant={doc.status === 'in_progress' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onSelectDocument(doc.id)}
                        className="h-8 text-xs font-semibold"
                      >
                        {actionText}
                      </Button>
                    </div>
                  </td>
                </TableRow>
              );
            })
          )}
        </tbody>
      </ClinicalTable>
    </TableContainer>
  );
}
