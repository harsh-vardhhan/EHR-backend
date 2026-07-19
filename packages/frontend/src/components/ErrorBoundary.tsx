import { Component, type ErrorInfo, type ReactNode } from 'react';
import styled from 'styled-components';
import { Button } from './ui/button';
import { AlertOctagon } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // Detect Chunk Load / Script Load / Dynamic module load errors
    const errorString = error.toString();
    const isChunkLoadFailed =
      errorString.includes('Failed to fetch dynamically imported module') ||
      errorString.includes('Loading chunk') ||
      errorString.includes('Failed to load module script') ||
      errorString.includes('dynamically imported module') ||
      (error.message && (
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Loading chunk') ||
        error.message.includes('Failed to load module script') ||
        error.message.includes('dynamically imported module')
      ));

    if (isChunkLoadFailed) {
      const lastReload = window.sessionStorage.getItem('chunk-failed-reloaded');
      const now = Date.now();
      // Only reload if we haven't reloaded in the last 15 seconds to prevent infinite reload loops
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        window.sessionStorage.setItem('chunk-failed-reloaded', now.toString());
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <FullPageLayout>
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-md bg-card rounded-xl border border-border shadow-lg">
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-full">
              <AlertOctagon className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Sorry, an unexpected error occurred in the clinical workstation.
            </p>
            <Button variant="default" onClick={() => window.location.reload()}>
              Reload Application
            </Button>
          </div>
        </FullPageLayout>
      );
    }

    return this.props.children;
  }
}

// --- Styled Components ---

const FullPageLayout = styled.div`
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: ${props => props.theme.colorBgLayout};
`;
