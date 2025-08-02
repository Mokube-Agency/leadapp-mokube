import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/authListener' // Auto-capture OAuth tokens on login

createRoot(document.getElementById("root")!).render(<App />);
