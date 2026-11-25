// Routes and app-wide providers.
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { PlanProvider } from './context/PlanContext';
import AppLayout from './components/layout/AppLayout';
import WelcomePage from './pages/WelcomePage';
import LocationPage from './pages/LocationPage';
import QuestionsPage from './pages/QuestionsPage';
import ResultsPage from './pages/ResultsPage';
import ChatPage from './pages/ChatPage';
import NotFoundPage from './pages/NotFoundPage';
import { ROUTES } from './constants/routes';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <PlanProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path={ROUTES.home} element={<WelcomePage />} />
            <Route path={ROUTES.location} element={<LocationPage />} />
            <Route path={ROUTES.questions} element={<QuestionsPage />} />
            <Route path={ROUTES.results} element={<ResultsPage />} />
            <Route path={ROUTES.chat} element={<ChatPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PlanProvider>
  );
}
