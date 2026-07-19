import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import styled from 'styled-components';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/toast';
import './index.css';

// Lazy load components for code splitting
const DocumentListView = lazy(() => import('./components/DocumentListView').then(module => ({ default: module.DocumentListView })));
const DocumentReviewView = lazy(() => import('./components/DocumentReviewView').then(module => ({ default: module.DocumentReviewView })));

const LoadingFallback = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <FallbackContainer $isDarkMode={isDarkMode}>
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </FallbackContainer>
);

// Wrapper to pass route params as props to DocumentReviewView
const DocumentReviewWrapper = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  if (!id) return null;
  
  return (
    <DocumentReviewView 
      documentId={id} 
      onBack={() => navigate('/')} 
    />
  );
};

// Wrapper to handle navigation for DocumentListView
const DocumentListWrapper = () => {
  const navigate = useNavigate();
  return <DocumentListView onSelectDocument={(id) => navigate(`/document/${id}`)} />;
};

const StyledThemeProvider = ({ children, isDarkMode }: { children: React.ReactNode, isDarkMode: boolean }) => {
  const themeConfig = {
    colorPrimary: '#6366f1',
    colorPrimaryHover: '#6366f1',
    borderRadius: 12,
    colorBorderSecondary: isDarkMode ? '#27272a' : '#e4e4e7',
    colorBorder: isDarkMode ? '#3f3f46' : '#d4d4d8',
    colorBgBase: isDarkMode ? '#09090b' : '#ffffff',
    colorBgContainer: isDarkMode ? '#18181b' : '#fafafa',
    colorBgLayout: isDarkMode ? '#09090b' : '#f4f4f5',
    colorText: isDarkMode ? '#f4f4f5' : '#09090b',
    colorTextBase: isDarkMode ? '#f4f4f5' : '#09090b',
    colorTextSecondary: isDarkMode ? '#a1a1aa' : '#71717a',
    colorTextTertiary: isDarkMode ? '#71717a' : '#a1a1aa',
    colorTextDescription: isDarkMode ? '#a1a1aa' : '#71717a',
    colorSuccess: '#10b981',
    colorError: '#ef4444',
    colorBgTextHover: isDarkMode ? '#27272a' : '#f4f4f5',
    fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };
  return <ThemeProvider theme={themeConfig}>{children}</ThemeProvider>;
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <StyledThemeProvider isDarkMode={isDarkMode}>
      <div className={isDarkMode ? 'dark-mode dark min-h-screen bg-background text-foreground' : 'light-mode min-h-screen bg-background text-foreground'}>
        <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback isDarkMode={isDarkMode} />}>
              <Routes>
                <Route path="/" element={<DocumentListWrapper />} />
                <Route path="/document/:id" element={<DocumentReviewWrapper />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
        <Toaster />
      </div>
    </StyledThemeProvider>
  );
}

// --- Styled Components ---

const FallbackContainer = styled.div<{ $isDarkMode: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: ${props => props.$isDarkMode ? '#000000' : '#f5f5f5'};
`;
