import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Toaster } from "@/components/ui/sonner"
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { ThemeProvider } from './store/ThemeContext';
import { hasSupabaseConfig } from './lib/supabase';
import { SetupScreen } from './components/SetupScreen';

import { Login } from './pages/Login';
import { SetupGuard } from './components/SetupGuard';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { PatientProfile } from './pages/PatientProfile';
import { Consultations } from './pages/Consultations';
import { Settings } from './pages/Settings';
import { Laboratory } from "./pages/Laboratory";
import { Pharmacy } from "./pages/Pharmacy";
import { Inventory } from "./pages/Inventory";
import { Billing } from "./pages/Billing";
import { Reports } from "./pages/Reports";
import { Staff } from "./pages/Staff";

const LoadingScreen = () => {
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowReset(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const handleReset = () => {
    localStorage.removeItem('SUPABASE_URL');
    localStorage.removeItem('SUPABASE_KEY');
    window.location.reload();
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
      <div className="animate-pulse space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-600 dark:text-slate-300 font-medium font-sans">Loading system components...</p>
      </div>
      {showReset && (
        <div className="mt-8 p-5 border border-dashed border-red-200 dark:border-red-900/40 rounded-xl max-w-sm bg-white dark:bg-slate-900/60 animate-fade-in shadow-md">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            Hanging for too long? This can happen if your previous database credentials or project expired or got deleted.
          </p>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleReset}
            className="w-full text-xs shadow-sm"
          >
            Reset Database Configuration
          </Button>
        </div>
      )}
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function AppContent() {
  if (!hasSupabaseConfig()) {
    return <SetupScreen />;
  }

  return (
    <SetupGuard>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="patients" element={<Patients />} />
          <Route path="patients/:id" element={<PatientProfile />} />
          <Route path="consultations" element={<Consultations />} />
          <Route path="laboratory" element={<Laboratory />} />
          <Route path="pharmacy" element={<Pharmacy />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="billing" element={<Billing />} />
          <Route path="reports" element={<Reports />} />
          <Route path="staff" element={<Staff />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster />
    </SetupGuard>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
