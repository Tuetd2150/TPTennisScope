import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { HomePage } from './pages/HomePage';
import { RankingsPage } from './pages/RankingsPage';
import { PlayerPage } from './pages/PlayerPage';
import { ComparePage } from './pages/ComparePage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/players/:id" element={<PlayerPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
