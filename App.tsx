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
import { BatchSelectionPage } from './pages/BatchSelectionPage';
import { BatchDashboard } from './pages/batch/BatchDashboard';
import { ParticipantDetailView } from './pages/batch/ParticipantDetailView';
import { LevelDetailView } from './pages/batch/LevelDetailView';
import { CreateBatch } from './pages/batch/CreateBatch';
import { QuizDashboard } from './pages/quiz/QuizDashboard';
import { CreateQuiz } from './pages/quiz/CreateQuiz';
import { QuizManagerDetail } from './pages/quiz/QuizManagerDetail';
import { TakeQuiz } from './pages/quiz/TakeQuiz';


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

    // With autoRefreshToken disabled in supabaseClient.ts, we manually refresh the session
    // every 30 minutes to prevent it from expiring during long sessions. This avoids the
    // disruptive on-focus refresh behavior.
    const sessionRefreshInterval = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        if (currentSession) {
          // This will trigger onAuthStateChange with a TOKEN_REFRESHED event
          supabase.auth.refreshSession();
        }
      });
    }, 30 * 60 * 1000); // every 30 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(sessionRefreshInterval);
    };
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
          setCurrentUser(profileData as unknown as Profile);
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
                setCurrentUser((linkedProfile as unknown as Profile[])[0]);
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
      return <Navigate to="/batches" replace />;
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
          {/* PUBLIC ROUTES */}
          <Route path="/leaderboard/:challengeId" element={<PublicLeaderboard />} />
          <Route path="/sub-challenge-leaderboard/:subChallengeId" element={<PublicSubChallengeLeaderboard />} />
          <Route path="/reset-password" element={<ResetPasswordPage onResetSuccess={handleResetSuccess} />} />

          {/* AUTH & ONBOARDING */}
          <Route path="/" element={
            isPasswordRecovery
              ? <Navigate to="/reset-password" replace />
              : !currentUser
                ? <LoginPage />
                : <Navigate to="/batches" />
          } />
          
          {/* PROTECTED ROUTES */}
          <Route element={<ProtectedRoute />}>
              <Route path="/batches" element={<BatchSelectionPage currentUser={currentUser!} />} />
              <Route path="/batch/:batchId" element={<BatchDashboard currentUser={currentUser!} />} />
              <Route path="/batch/:batchId/participant/:participantId" element={<ParticipantDetailView />} />
              <Route path="/batch/:batchId/level/:levelId" element={<LevelDetailView currentUser={currentUser!} />} />
              
              {/* Quiz Module Routes */}
              <Route path="/batch/:batchId/quiz" element={<QuizDashboard currentUser={currentUser!} />} />
              <Route path="/batch/:batchId/quiz/take/:quizId" element={<TakeQuiz currentUser={currentUser!} />} />
            
            <Route element={<ProtectedRoute allowedRoles={[Role.MANAGER]} />}>
              {/* Batch Management */}
              <Route path="/create-batch" element={<CreateBatch currentUser={currentUser!} />} />
              
              {/* Tour de Prior Art Routes (Level 4) */}
              <Route path="/batch/:batchId/level/4/manager" element={<ManagerDashboard currentUser={currentUser!} />} />
              <Route path="/batch/:batchId/level/4/users" element={<UserManagement />} />
              <Route path="/batch/:batchId/level/4/import-users" element={<ImportUsers />} />
              <Route path="/batch/:batchId/level/4/challenge/:challengeId" element={<ChallengeDetail currentUser={currentUser!} />} />
              <Route path="/batch/:batchId/level/4/challenge/:challengeId/trainee/:traineeId" element={<TraineePerforma />} />
              <Route path="/batch/:batchId/level/4/create-challenge" element={<CreateChallenge currentUser={currentUser!} />} />
              <Route path="/batch/:batchId/level/4/challenge/:challengeId/create-sub-challenge" element={<CreateSubChallenge />} />
              <Route path="/batch/:batchId/level/4/sub-challenge/:subChallengeId" element={<SubChallengeDetail currentUser={currentUser!} />} />

              {/* Quiz Module Manager Routes */}
              <Route path="/batch/:batchId/quiz/create" element={<CreateQuiz currentUser={currentUser!} />} />
              <Route path="/batch/:batchId/quiz/manage/:quizId" element={<QuizManagerDetail />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[Role.TRAINEE]} />}>
              <Route path="/batch/:batchId/level/4/trainee" element={<TraineeDashboard currentUser={currentUser!} />} />
              <Route path="/batch/:batchId/level/4/trainee/challenge/:challengeId/submit" element={<SubmitChallenge currentUser={currentUser!} />} />
              <Route path="/batch/:batchId/level/4/trainee/sub-challenge/:subChallengeId" element={<SubChallengeDetail currentUser={currentUser!} />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[Role.EVALUATOR, Role.MANAGER]} />}>
              <Route path="/batch/:batchId/level/4/evaluator" element={<EvaluatorDashboard currentUser={currentUser!} />} />
              <Route path="/batch/:batchId/level/4/evaluator/challenge/:challengeId/evaluate" element={<EvaluateSubmission currentUser={currentUser!} />} />
            </Route>
            
            {/* Redirect for Level 4 base URL to role-specific dashboards */}
            <Route path="/batch/:batchId/level/4" element={
              currentUser && currentUser.role === Role.MANAGER ? <Navigate to="manager" replace /> :
              currentUser && currentUser.role === Role.TRAINEE ? <Navigate to="trainee" replace /> :
              currentUser && currentUser.role === Role.EVALUATOR ? <Navigate to="evaluator" replace /> :
              <Navigate to="/batches" />
            } />
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