import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { ACCES_MEMBRE, ROLE_ADMIN } from './auth/auth';
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
const ModerationPage = lazy(() => import('./pages/admin/ModerationPage').then((m) => ({ default: m.ModerationPage })));
// Espace communautaire (US8 à US12) : un fichier par page, chargé à la demande.
const TrocPage = lazy(() => import('./pages/communaute/TrocPage').then((m) => ({ default: m.TrocPage })));
const AnnoncePage = lazy(() => import('./pages/communaute/AnnoncePage').then((m) => ({ default: m.AnnoncePage })));
const PublierPage = lazy(() => import('./pages/communaute/PublierPage').then((m) => ({ default: m.PublierPage })));
const PropositionsPage = lazy(() =>
  import('./pages/communaute/PropositionsPage').then((m) => ({ default: m.PropositionsPage })),
);
const PropositionPage = lazy(() =>
  import('./pages/communaute/PropositionPage').then((m) => ({ default: m.PropositionPage })),
);
const SalonsPage = lazy(() => import('./pages/communaute/SalonsPage').then((m) => ({ default: m.SalonsPage })));
const SalonPage = lazy(() => import('./pages/communaute/SalonsPage').then((m) => ({ default: m.SalonPage })));
const MonEspacePage = lazy(() => import('./pages/MonEspacePage').then((m) => ({ default: m.MonEspacePage })));
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
        <Route
          path="admin/moderation"
          element={
            <ConnexionRequise role={ROLE_ADMIN}>
              <ModerationPage />
            </ConnexionRequise>
          }
        />
        <Route path="communaute" element={<TrocPage />} />
        <Route path="communaute/annonces/:id" element={<AnnoncePage />} />
        <Route
          path="communaute/publier"
          element={
            <ConnexionRequise role={ACCES_MEMBRE}>
              <PublierPage />
            </ConnexionRequise>
          }
        />
        <Route
          path="communaute/propositions"
          element={
            <ConnexionRequise role={ACCES_MEMBRE}>
              <PropositionsPage />
            </ConnexionRequise>
          }
        />
        <Route
          path="communaute/propositions/:id"
          element={
            <ConnexionRequise role={ACCES_MEMBRE}>
              <PropositionPage />
            </ConnexionRequise>
          }
        />
        <Route
          path="communaute/salons"
          element={
            <ConnexionRequise role={ACCES_MEMBRE}>
              <SalonsPage />
            </ConnexionRequise>
          }
        />
        <Route
          path="communaute/salons/:code"
          element={
            <ConnexionRequise role={ACCES_MEMBRE}>
              <SalonPage />
            </ConnexionRequise>
          }
        />
        <Route
          path="mon-espace"
          element={
            <ConnexionRequise role={ACCES_MEMBRE}>
              <MonEspacePage />
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
