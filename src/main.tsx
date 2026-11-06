import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { DataProvider } from './context/DataContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <DataProvider>
      <App />
    </DataProvider>
  </ErrorBoundary>
);
