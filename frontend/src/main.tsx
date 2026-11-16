import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { creerSourceKeycloak } from './auth/keycloak';
import { PanierProvider } from './cart/PanierProvider';
import { chargerConfig } from './config';
import './styles.css';

async function demarrer() {
  const config = await chargerConfig();
  const auth = creerSourceKeycloak(config);
  void auth.demarrer();
  const racine = document.getElementById('racine');
  if (!racine) throw new Error('Élément #racine absent de index.html');
  createRoot(racine).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider source={auth}>
          <PanierProvider>
            <App />
          </PanierProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

void demarrer();
