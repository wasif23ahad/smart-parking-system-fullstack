import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import MonitoringPage from './pages/MonitoringPage';
import AlertsPage from './pages/AlertsPage';
import ReportsPage from './pages/ReportsPage';
import { AppQueryProvider } from './lib/queryProvider';

function App() {
  return (
    <AppQueryProvider>
      <BrowserRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/monitor" element={<MonitoringPage />} />
            <Route path="/zones" element={<div>Zones & Slots (Coming Soon)</div>} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </AppQueryProvider>
  );
}

export default App;
