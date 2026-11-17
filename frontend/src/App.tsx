import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { ROLE_ADMIN } from './auth/auth';
import { ConnexionRequise } from './components/ConnexionRequise';
import { Layout } from './components/Layout';
import { CataloguePage } from './pages/CataloguePage';
import { PageIntrouvable } from './pages/PageIntrouvable';
import { PanierPage } from './pages/PanierPage';
import { ProduitPage } from './pages/ProduitPage';

// Parcours d'achat dans le bundle principal ; pages connectées, d'administration et d'information chargées à la
// demande (fichiers séparés, même origine : compatible avec la CSP).
const CommandesPage = lazy(() => import('./pages/CommandesPage').then((m) => ({ default: m.CommandesPage })));
const CommandePage = lazy(() => import('./pages/CommandePage').then((m) => ({ default: m.CommandePage })));
const StockPage = lazy(() => import('./pages/admin/StockPage').then((m) => ({ default: m.StockPage })));
const PlanDuSitePage = lazy(() => import('./pages/infos/PlanDuSitePage').then((m) => ({ default: m.PlanDuSitePage })));
const AccessibilitePage = lazy(() =>
  import('./pages/infos/AccessibilitePage').then((m) => ({ default: m.AccessibilitePage })),
);
const MentionsLegalesPage = lazy(() =>
  import('./pages/infos/MentionsLegalesPage').then((m) => ({ default: m.MentionsLegalesPage })),
);
const DonneesPersonnellesPage = lazy(() =>
  import('./pages/infos/DonneesPersonnellesPage').then((m) => ({ default: m.DonneesPersonnellesPage })),
);

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CataloguePage />} />
        <Route path="produits/:id" element={<ProduitPage />} />
        <Route path="panier" element={<PanierPage />} />
        <Route
          path="commandes"
          element={
            <ConnexionRequise>
              <CommandesPage />
            </ConnexionRequise>
          }
        />
        <Route
          path="commandes/:id"
          element={
            <ConnexionRequise>
              <CommandePage />
            </ConnexionRequise>
          }
        />
        <Route
          path="admin/stock"
          element={
            <ConnexionRequise role={ROLE_ADMIN}>
              <StockPage />
            </ConnexionRequise>
          }
        />
        <Route path="plan-du-site" element={<PlanDuSitePage />} />
        <Route path="accessibilite" element={<AccessibilitePage />} />
        <Route path="mentions-legales" element={<MentionsLegalesPage />} />
        <Route path="donnees-personnelles" element={<DonneesPersonnellesPage />} />
        <Route path="*" element={<PageIntrouvable />} />
      </Route>
    </Routes>
  );
}
