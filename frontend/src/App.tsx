import { Route, Routes } from 'react-router';
import { ConnexionRequise } from './components/ConnexionRequise';
import { Layout } from './components/Layout';
import { CataloguePage } from './pages/CataloguePage';
import { CommandePage } from './pages/CommandePage';
import { CommandesPage } from './pages/CommandesPage';
import { PageIntrouvable } from './pages/PageIntrouvable';
import { PanierPage } from './pages/PanierPage';
import { ProduitPage } from './pages/ProduitPage';

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
        <Route path="*" element={<PageIntrouvable />} />
      </Route>
    </Routes>
  );
}
