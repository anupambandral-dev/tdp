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
import { ImportUsers } from './pages/manager/ImportUsers';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Hook 1: Manages the session state. It's the single source of truth for authentication status.
  useEffect(() => {
    // Check for an existing session on initial load.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for changes in authentication state (login, logout).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    // Cleanup the subscription when the component unmounts.
    return () => subscription.unsubscribe();
  }, []);

  // Hook 2: Manages the user profile based on the session state.
  // This hook runs only when the session changes, cleanly separating concerns.
  useEffect(() => {
    // If a session exists, fetch the user's profile.
    if (session?.user) {
      const fetchProfile = async () => {
        // First, try to get the profile the standard way (already linked).
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_id', session.user.id)
          .single();

        // Case 1: Profile found successfully.
        if (profileData) {
          setCurrentUser(profileData as Profile);
          setLoading(false);
          return;
        }

        // Case 2: An actual error occurred (not just 'no rows found').
        if (profileError && profileError.code !== 'PGRST116') {
            console.error("Error fetching profile:", profileError);
            await supabase.auth.signOut();
            setCurrentUser(null);
            setLoading(false);
            return;
        }
        
        // Case 3: No profile found (PGRST116), which means this is the first login.
        // Call the RPC to link the auth user to their profile via email.
        if (!profileData) {
            console.log('No profile linked yet. Attempting to link now...');
            const { data: linkedProfile, error: rpcError } = await supabase.rpc('link_auth_to_profile');

            if (rpcError) {
                console.error('Error linking profile:', rpcError);
                await supabase.auth.signOut();
                setCurrentUser(null);
            } else if (linkedProfile && linkedProfile.length > 0) {
                console.log('Profile successfully linked.');
                setCurrentUser(linkedProfile[0] as Profile);
            } else {
                console.error("Could not find a profile to link for this user. The manager may not have imported this user's profile yet. Signing out.");
                await supabase.auth.signOut();
                setCurrentUser(null);
            }
        }
        setLoading(false);
      };
      fetchProfile();
    } else {
      // If there is no session, ensure the user profile is cleared and stop loading.
      setCurrentUser(null);
      setLoading(false);
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Force a reload to ensure all state is cleared, preventing issues with stale session data
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
        {currentUser && <Header currentUser={currentUser} onLogout={handleLogout} />}
        <main className="flex-grow">
          <Routes>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/" element={!currentUser ? <LoginPage /> : <Navigate to={`/${currentUser.role.toLowerCase()}`} />} />
            
            <Route element={<ProtectedRoute allowedRoles={[Role.MANAGER]} />}>
              <Route path="/manager" element={currentUser ? <ManagerDashboard currentUser={currentUser} /> : null} />
               <Route path="/manager/users" element={<UserManagement />} />
               <Route path="/manager/import-users" element={<ImportUsers />} />
              <Route path="/manager/challenge/:challengeId" element={currentUser ? <ChallengeDetail currentUser={currentUser} /> : null} />
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

            <Route element={<ProtectedRoute allowedRoles={[Role.EVALUATOR, Role.MANAGER]} />}>
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