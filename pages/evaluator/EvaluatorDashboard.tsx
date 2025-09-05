import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Profile, SubChallengeForEvaluator, Role } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';

interface EvaluatorDashboardProps {
  currentUser: Profile;
}

export const EvaluatorDashboard: React.FC<EvaluatorDashboardProps> = ({ currentUser }) => {
  const [assignedChallenges, setAssignedChallenges] = useState<SubChallengeForEvaluator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChallenges = async () => {
        if (currentUser.role === Role.MANAGER) {
            const { data: managedChallenges, error: mcError } = await supabase
                .from('overall_challenges')
                .select('id')
                .contains('manager_ids', [currentUser.id]);
            
            if (mcError) {
                setError(mcError.message);
                return;
            }
            if (!managedChallenges || managedChallenges.length === 0) {
                setAssignedChallenges([]);
                return;
            }
            const managedChallengeIds = managedChallenges.map(c => c.id);

            const { data: potentialChallenges, error: scError } = await supabase
                .from('sub_challenges')
                .select('*, submissions(*, profiles(*))')
                .or(`evaluator_ids.cs.{${currentUser.id}},overall_challenge_id.in.(${managedChallengeIds.join(',')})`);
            
            if (scError) {
                setError(scError.message);
                return;
            }

            if (potentialChallenges) {
                const challengesForManager = potentialChallenges.filter(sc => {
                    const isExplicitlyAssigned = sc.evaluator_ids?.includes(currentUser.id);
                    const isImplicitlyAssigned = (!sc.evaluator_ids || sc.evaluator_ids.length === 0) && managedChallengeIds.includes(sc.overall_challenge_id);
                    return isExplicitlyAssigned || isImplicitlyAssigned;
                });
                setAssignedChallenges(challengesForManager as unknown as SubChallengeForEvaluator[]);
            }

        } else { // Role.EVALUATOR
            const { data, error } = await supabase
                .from('sub_challenges')
                .select('*, submissions(*, profiles(*))')
                .contains('evaluator_ids', [currentUser.id]);

            if (error) {
                setError(error.message);
            } else if (data) {
                setAssignedChallenges(data as unknown as SubChallengeForEvaluator[]);
            }
        }
    };
    
    const initialFetch = async () => {
        setLoading(true);
        await fetchChallenges();
        setLoading(false);
    }
    initialFetch();

    // Set up real-time subscription
    const channel = supabase
      .channel('evaluator-dashboard-challenges')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sub_challenges' },
        () => fetchChallenges()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        () => fetchChallenges()
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id, currentUser.role]);

  const getEvaluationStats = (challenge: SubChallengeForEvaluator) => {
    const totalSubmissions = challenge.submissions?.length || 0;
    const evaluatedSubmissions = challenge.submissions?.filter(s => !!s.evaluation).length || 0;
    return { totalSubmissions, evaluatedSubmissions };
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {currentUser.role === Role.MANAGER && (
        <BackButton to="/manager" text="Back to Manager Dashboard" />
      )}
      <h1 className="text-3xl font-bold mb-6">Evaluator Dashboard</h1>
      
      {loading && <p>Loading evaluation queue...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div className="space-y-6">
          {assignedChallenges.map((challenge) => {
              const { totalSubmissions, evaluatedSubmissions } = getEvaluationStats(challenge);
              const progress = totalSubmissions > 0 ? (evaluatedSubmissions / totalSubmissions) * 100 : 0;
              const endTime = challenge.submission_end_time;
              return (
              <Card key={challenge.id}>
                <div className="md:flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold">{challenge.title}</h2>
                    {endTime && <p className="text-sm text-gray-500 dark:text-gray-400">Submissions Ended: {new Date(endTime).toLocaleDateString()}</p>}
                  </div>
                  <div className="mt-4 md:mt-0 flex items-center space-x-4">
                      <div className="w-48">
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Evaluation Progress ({evaluatedSubmissions}/{totalSubmissions})</p>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                          </div>
                      </div>
                    <Link to={`/evaluator/challenge/${challenge.id}/evaluate`}>
                      <Button disabled={totalSubmissions === 0}>Evaluate</Button>
                    </Link>
                  </div>
                </div>
              </Card>
              );
          })}
        </div>
      )}
      {!loading && assignedChallenges.length === 0 && (
          <Card className="text-center py-10">
              <p className="text-gray-500">You have no challenges assigned for evaluation.</p>
          </Card>
      )}
    </div>
  );
};