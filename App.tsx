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
import { supabase, initializationError } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import { UserManagement } from './pages/manager/UserManagement';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAndSetProfile = async (user: Session['user']) => {
    // This single RPC call is now the source of truth.
    // It finds the user's profile by their email, links the auth_id if it's not set,
    // and returns the complete, up-to-date profile in one atomic operation.
    // This eliminates all client-side race conditions.
    const { data: profile, error } = await supabase
      .rpc('link_auth_to_profile')
      .single<Profile>();

    if (error || !profile) {
      // This is a critical error. The user is authenticated with Supabase Auth,
      // but we cannot find or link their corresponding profile in the database.
      // To prevent the app from being in a broken state, we must sign them out.
      console.error("CRITICAL: Could not fetch or link user profile. Signing out.", error);
      await supabase.auth.signOut();
      setCurrentUser(null);
      setSession(null);
      return;
    }

    // Success! The profile is guaranteed to be correct and linked.
    setCurrentUser(profile);
  };


  useEffect(() => {
    if (initializationError) {
        setLoading(false);
        return;
    }

    const getSessionAndProfile = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        setSession(session);

        if (session?.user) {
          await fetchAndSetProfile(session.user);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error("Error during initial session fetch:", error);
        setCurrentUser(null);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    
    getSessionAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if(session?.user) {
          await fetchAndSetProfile(session.user);
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
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
