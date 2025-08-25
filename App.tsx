import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Role } from './types';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { ManagerDashboard } from './pages/manager/ManagerDashboard';
import { TraineeDashboard } from './pages/trainee/TraineeDashboard';
import { EvaluatorDashboard } from './pages/evaluator/EvaluatorDashboard';
import { ChallengeDetail } from './pages/manager/ChallengeDetail';
import { SubmitChallenge } from './pages/trainee/SubmitChallenge';
import { EvaluateSubmission } from './pages/evaluator/EvaluateSubmission';
import { CreateChallenge } from './pages/manager/CreateChallenge';
import { CreateSubChallenge } from './pages/manager/CreateSubChallenge';
import { SubChallengeDetail } from './pages/shared/SubChallengeDetail';
import { TraineePerforma } from './pages/manager/TraineePerforma';
import { supabase, initializationError } from './supabaseClient';
import { UserManagement } from './pages/manager/UserManagement';
import { ImportUsers } from './pages/manager/ImportUsers';
import { useAuth } from './contexts/AuthContext';

const App: React.FC = () => {
  const { session, currentUser, loading } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const ProtectedRoute: React.FC<{ allowedRoles: Role[] }> = ({ allowedRoles }) => {
    if (loading) {
      return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
    }
    if (!currentUser) {
      return <Navigate to="/" replace />;
    }
    if (!allowedRoles.includes(currentUser.role)) {
      return <Navigate to={`/${currentUser.role.toLowerCase()}`} replace />;
    }
    return <Outlet />;
  };

  if (initializationError) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100">
          <div className="text-center max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">Application Configuration Error</h1>
            <p className="mb-4">The application cannot start because it's missing essential configuration.</p>
            <p className="bg-red-200 dark:bg-red-800 p-4 rounded-lg font-mono text-sm text-left">{initializationError}</p>
             <p className="mt-4 text-sm">Please ensure you have correctly set up your environment variables.</p>
          </div>
        </div>
    );
  }
  
  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <p className="text-gray-500">Loading application...</p>
        </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {currentUser && <Header onLogout={handleLogout} />}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={!currentUser ? <LoginPage /> : <Navigate to={`/${currentUser.role.toLowerCase()}`} />} />
            
            <Route element={<ProtectedRoute allowedRoles={[Role.MANAGER]} />}>
              <Route path="/manager" element={<ManagerDashboard />} />
               <Route path="/manager/users" element={<UserManagement />} />
               <Route path="/manager/import-users" element={<ImportUsers />} />
              <Route path="/manager/challenge/:challengeId" element={<ChallengeDetail />} />
              <Route path="/manager/challenge/:challengeId/trainee/:traineeId" element={<TraineePerforma />} />
              <Route path="/manager/create-challenge" element={<CreateChallenge />} />
              <Route path="/manager/challenge/:challengeId/create-sub-challenge" element={<CreateSubChallenge />} />
              <Route path="/manager/sub-challenge/:subChallengeId" element={<SubChallengeDetail />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[Role.TRAINEE]} />}>
              <Route path="/trainee" element={<TraineeDashboard />} />
              <Route path="/trainee/challenge/:challengeId/submit" element={<SubmitChallenge />} />
              <Route path="/trainee/sub-challenge/:subChallengeId" element={<SubChallengeDetail />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[Role.EVALUATOR]} />}>
              <Route path="/evaluator" element={<EvaluatorDashboard />} />
              <Route path="/evaluator/challenge/:challengeId/evaluate" element={<EvaluateSubmission />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;