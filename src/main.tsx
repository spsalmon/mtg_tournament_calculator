import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { setInvariantChecks } from './core/invariants';
import './index.css';

setInvariantChecks(import.meta.env.DEV);

const host = document.getElementById('root');
if (host === null) throw new Error('#root missing from index.html');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
