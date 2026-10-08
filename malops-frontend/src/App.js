import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import EngineerLayout from './components/EngineerLayout';
import ScientistLayout from './components/ScientistLayout';
import ClientLayout from './components/ClientLayout';

// Pages communes
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import MapPage from './pages/Map';
import Weather from './pages/Weather';
import Dashboard from './pages/Dashboard';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import ProjectManagement from './pages/admin/ProjectManagement';
import ModelsLibrary from './pages/admin/ModelsLibrary';
import PipelineStatus from './pages/admin/PipelineStatus';

// Engineer pages
import DatasetConfig     from './pages/engineer/DatasetConfig';
import ValidationConfig  from './pages/engineer/ValidationConfig';
import ValidationReport  from './pages/engineer/ValidationReport';
import QualityDashboard  from './pages/engineer/QualityDashboard';
import DatasetCreate     from './pages/engineer/DatasetCreate';
import DatasetList       from './pages/engineer/DatasetList';

// Client pages
import ClientPrediction    from './pages/client/ClientPrediction';
import AnalyticsDashboard  from './pages/client/AnalyticsDashboard';
import ClientMap           from './pages/client/ClientMap';

// Scientist pages
import TrainingProgress    from './pages/scientist/TrainingProgress';
import ModelComparison     from './pages/scientist/ModelComparison';
import PipelineManager     from './pages/scientist/PipelineManager';
import ClearMLEmbed        from './pages/scientist/ClearMLEmbed';
import OrchestratorWizard  from './pages/scientist/OrchestratorWizard';

const AppContent = () => {
  const location = useLocation();
  const hideNavbar = location.pathname === '/'
    || location.pathname === '/login'
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/engineer')
    || location.pathname.startsWith('/scientist')
    || location.pathname.startsWith('/client');

  return (
    <div className="app-container">
      {!hideNavbar && <Navbar />}
      <main className="main-content">
        <Routes>
          <Route path="/login"     element={<Login />} />
          <Route path="/map"       element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
          <Route path="/weather"   element={<ProtectedRoute><Weather /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin"
            element={<ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users"     element={<UserManagement />} />
            <Route path="projects"  element={<ProjectManagement />} />
            <Route path="models"    element={<ModelsLibrary />} />
            <Route path="pipelines" element={<PipelineStatus />} />
          </Route>

          {/* Client Final */}
          <Route path="/client"
            element={<ProtectedRoute requireRole="mlops_engineer"><ClientLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="prediction" replace />} />
            <Route path="prediction" element={<ClientPrediction />} />
            <Route path="analytics"  element={<AnalyticsDashboard />} />
            <Route path="map"        element={<ClientMap />} />
          </Route>

          {/* Data Engineer */}
          <Route path="/engineer"
            element={<ProtectedRoute requireRole="data_engineer"><EngineerLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dataset-config" replace />} />
            <Route path="dataset-config"    element={<DatasetConfig />} />
            <Route path="validation-config" element={<ValidationConfig />} />
            <Route path="validation"        element={<ValidationReport />} />
            <Route path="quality-dashboard" element={<QualityDashboard />} />
            {/* Legacy routes */}
            <Route path="datasets"          element={<DatasetList />} />
            <Route path="datasets/create"   element={<DatasetCreate />} />
          </Route>

          {/* Data Scientist */}
          <Route path="/scientist"
            element={<ProtectedRoute requireRole="data_scientist"><ScientistLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="training" replace />} />
            <Route path="training"      element={<TrainingProgress />} />
            <Route path="models"        element={<ModelComparison />} />
            <Route path="predictions"   element={<ClientMap />} />
            <Route path="pipelines"     element={<PipelineManager />} />
            <Route path="clearml-ui"           element={<ClearMLEmbed />} />
            <Route path="orchestrator-wizard"  element={<OrchestratorWizard />} />
          </Route>

          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <Router>
      <AppContent />
    </Router>
  </AuthProvider>
);

export default App;
