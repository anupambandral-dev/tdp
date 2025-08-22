
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Profile, Role } from './types';
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
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import { UserManagement } from './pages/manager/UserManagement';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if(session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile) setCurrentUser(profile);
      }
      setLoading(false);
    };
    
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if(session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (profile) setCurrentUser(profile);
        } else {
          setCurrentUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
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
        {currentUser && <Header currentUser={currentUser} onLogout={handleLogout} />}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={!currentUser ? <LoginPage /> : <Navigate to={`/${currentUser.role.toLowerCase()}`} />} />
            
            <Route element={<ProtectedRoute allowedRoles={[Role.MANAGER]} />}>
              <Route path="/manager" element={currentUser ? <ManagerDashboard currentUser={currentUser} /> : null} />
               <Route path="/manager/users" element={<UserManagement />} />
              <Route path="/manager/challenge/:challengeId" element={<ChallengeDetail />} />
              <Route path="/manager/challenge/:challengeId/trainee/:traineeId" element={<TraineePerforma />} />
              <Route path="/manager/create-challenge" element={currentUser ? <CreateChallenge currentUser={currentUser} /> : null} />
              <Route path="/manager/challenge/:challengeId/create-sub-challenge" element={<CreateSubChallenge />} />
              <Route path="/manager/sub-challenge/:subChallengeId" element={currentUser ? <SubChallengeDetail currentUser={currentUser} /> : null} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[Role.TRAINEE]} />}>
              <Route path="/trainee" element={currentUser ? <TraineeDashboard currentUser={currentUser} /> : null} />
              <Route path="/trainee/challenge/:challengeId/submit" element={currentUser ? <SubmitChallenge currentUser={currentUser} /> : null} />
              <Route path="/trainee/sub-challenge/:subChallengeId" element={currentUser ? <SubChallengeDetail currentUser={currentUser} /> : null} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[Role.EVALUATOR]} />}>
              <Route path="/evaluator" element={currentUser ? <EvaluatorDashboard currentUser={currentUser} /> : null} />
              <Route path="/evaluator/challenge/:challengeId/evaluate" element={currentUser ? <EvaluateSubmission currentUser={currentUser} /> : null} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
