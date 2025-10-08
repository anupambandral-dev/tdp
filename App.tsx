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
import { PublicLeaderboard } from './pages/PublicLeaderboard';
import { PublicSubChallengeLeaderboard } from './pages/PublicSubChallengeLeaderboard';
import { MainDashboard } from './pages/MainDashboard';
import { QuizDashboard } from './pages/quiz/QuizDashboard';
import { TourDePriorArtIndex } from './pages/TourDePriorArtIndex';


const AppContent: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    if (window.location.hash.includes('type=recovery')) {
        sessionStorage.setItem('isPasswordRecovery', 'true');
        return true;
    }
    return sessionStorage.getItem('isPasswordRecovery') === 'true';
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session && !isPasswordRecovery) {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        if (event === 'PASSWORD_RECOVERY') {
          sessionStorage.setItem('isPasswordRecovery', 'true');
          setIsPasswordRecovery(true);
        }
        
        if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            sessionStorage.removeItem('isPasswordRecovery');
            setIsPasswordRecovery(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      if (isPasswordRecovery) {
        setLoading(false);
        return;
      }
      const fetchProfile = async () => {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_id', session.user.id)
          .single();

        if (profileData) {
          setCurrentUser(profileData as Profile);
          setLoading(false);
          return;
        }

        if (profileError && profileError.code !== 'PGRST116') {
            console.error("Error fetching profile:", profileError);
            await supabase.auth.signOut();
            setCurrentUser(null);
            setLoading(false);
            return;
        }
        
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
                console.error("Could not find a profile to link for this user. Signing out.");
                await supabase.auth.signOut();
                setCurrentUser(null);
            }
        }
        setLoading(false);
      };
      fetchProfile();
    } else {
      setCurrentUser(null);
      if (!isPasswordRecovery) {
          setLoading(false);
      }
    }
  }, [session, isPasswordRecovery]);

  const handleLogout = async () => {
    sessionStorage.removeItem('isPasswordRecovery');
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleResetSuccess = () => {
    sessionStorage.removeItem('isPasswordRecovery');
    setIsPasswordRecovery(false);
  };

  const ProtectedRoute: React.FC<{ allowedRoles?: Role[] }> = ({ allowedRoles }) => {
    if (loading) {
      return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
    }
    if (!currentUser) {
      return <Navigate to="/" replace />;
    }
    if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Outlet />;
  };

  if (initializationError) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100">
          <div className="text-center max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">Application Configuration Error</h1>
            <p className="mb-4">{initializationError}</p>
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
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {currentUser && !isPasswordRecovery && <Header currentUser={currentUser} onLogout={handleLogout} />}
      <main className="flex-grow">
        <Routes>
          <Route path="/leaderboard/:challengeId" element={<PublicLeaderboard />} />
          <Route path="/sub-challenge-leaderboard/:subChallengeId" element={<PublicSubChallengeLeaderboard />} />
          <Route path="/reset-password" element={<ResetPasswordPage onResetSuccess={handleResetSuccess} />} />

          <Route path="/" element={
            isPasswordRecovery
              ? <Navigate to="/reset-password" replace />
              : !currentUser
                ? <LoginPage />
                : <Navigate to="/dashboard" />
          } />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<MainDashboard currentUser={currentUser!} />} />
            <Route path="/quiz" element={<QuizDashboard />} />
            <Route path="/tour-de-prior-art" element={<TourDePriorArtIndex currentUser={currentUser!} />} />

            <Route element={<ProtectedRoute allowedRoles={[Role.MANAGER]} />}>
              <Route path="/tour-de-prior-art/manager" element={<ManagerDashboard currentUser={currentUser!} />} />
              <Route path="/tour-de-prior-art/manager/users" element={<UserManagement />} />
              <Route path="/tour-de-prior-art/manager/import-users" element={<ImportUsers />} />
              <Route path="/tour-de-prior-art/manager/challenge/:challengeId" element={<ChallengeDetail currentUser={currentUser!} />} />
              <Route path="/tour-de-prior-art/manager/challenge/:challengeId/trainee/:traineeId" element={<TraineePerforma />} />
              <Route path="/tour-de-prior-art/manager/create-challenge" element={<CreateChallenge currentUser={currentUser!} />} />
              <Route path="/tour-de-prior-art/manager/challenge/:challengeId/create-sub-challenge" element={<CreateSubChallenge />} />
              <Route path="/tour-de-prior-art/manager/sub-challenge/:subChallengeId" element={<SubChallengeDetail currentUser={currentUser!} />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[Role.TRAINEE]} />}>
              <Route path="/tour-de-prior-art/trainee" element={<TraineeDashboard currentUser={currentUser!} />} />
              <Route path="/tour-de-prior-art/trainee/challenge/:challengeId/submit" element={<SubmitChallenge currentUser={currentUser!} />} />
              <Route path="/tour-de-prior-art/trainee/sub-challenge/:subChallengeId" element={<SubChallengeDetail currentUser={currentUser!} />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[Role.EVALUATOR, Role.MANAGER]} />}>
              <Route path="/tour-de-prior-art/evaluator" element={<EvaluatorDashboard currentUser={currentUser!} />} />
              <Route path="/tour-de-prior-art/evaluator/challenge/:challengeId/evaluate" element={<EvaluateSubmission currentUser={currentUser!} />} />
            </Route>
          </Route>
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}


const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
