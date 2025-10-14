
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Profile, SubChallengeForEvaluator, Role } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';

interface EvaluatorDashboardProps {
  currentUser: Profile;
}

export const EvaluatorDashboard: React.FC<EvaluatorDashboardProps> = ({ currentUser }) => {
  const { batchId } = useParams<{ batchId: string }>();
  const [assignedChallenges, setAssignedChallenges] = useState<SubChallengeForEvaluator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChallenges = useCallback(async () => {
    if (!batchId) {
        setAssignedChallenges([]);
        return;
    }
    setLoading(true);
    setError(null);

    // 1. Get all overall_challenges in the current batch
    const { data: ocInBatch, error: ocError } = await supabase
        .from('overall_challenges')
        .select('id, manager_ids')
        .eq('batch_id', batchId);

    if (ocError) {
        setError(ocError.message);
        setLoading(false);
        return;
    }
    if (!ocInBatch || ocInBatch.length === 0) {
        setAssignedChallenges([]);
        setLoading(false);
        return;
    }

    const ocIdsInBatch = ocInBatch.map(oc => oc.id);
    const isManager = currentUser.role === Role.MANAGER;
    let managedOcIds: string[] = [];

    if (isManager) {
        managedOcIds = ocInBatch
            .filter(oc => oc.manager_ids.includes(currentUser.id))
            .map(oc => oc.id);
    }
    
    // 2. Build a query to get all potentially relevant sub-challenges
    let query = supabase
        .from('sub_challenges')
        .select('*, submissions(*, profiles(*))')
        .in('overall_challenge_id', ocIdsInBatch);

    const orConditions = [`evaluator_ids.cs.{${currentUser.id}}`];
    if (isManager && managedOcIds.length > 0) {
        orConditions.push(`overall_challenge_id.in.(${managedOcIds.join(',')})`);
    }
    query = query.or(orConditions.join(','));

    const { data: potentialChallenges, error: scError } = await query;
    
    if (scError) {
        setError(scError.message);
        setLoading(false);
        return;
    }

    // 3. Client-side filter to apply the precise logic
    if (potentialChallenges) {
        const finalChallenges = potentialChallenges.filter(sc => {
            // A user can see a challenge if:
            // a) They are explicitly assigned as an evaluator.
            const isExplicitlyAssigned = sc.evaluator_ids?.includes(currentUser.id);
            if (isExplicitlyAssigned) return true;

            // b) They are a manager, AND the challenge has no explicit evaluators, AND they manage the parent overall challenge.
            if (isManager) {
                const isImplicitlyAssigned =
                    (!sc.evaluator_ids || sc.evaluator_ids.length === 0) &&
                    managedOcIds.includes(sc.overall_challenge_id);
                if (isImplicitlyAssigned) return true;
            }
            return false;
        });
        setAssignedChallenges(finalChallenges as unknown as SubChallengeForEvaluator[]);
    } else {
        setAssignedChallenges([]);
    }

    setLoading(false);
}, [batchId, currentUser.id, currentUser.role]);


  useEffect(() => {
    const initialFetch = async () => {
        setLoading(true);
        await fetchChallenges();
        setLoading(false);
    }
    initialFetch();

    // Set up real-time subscription
    const channel = supabase
      .channel(`evaluator-dashboard-challenges-${batchId}`)
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
       .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'overall_challenges', filter: `batch_id=eq.${batchId}` },
        () => fetchChallenges()
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId, fetchChallenges]);

  const getEvaluationStats = (challenge: SubChallengeForEvaluator) => {
    const totalSubmissions = challenge.submissions?.length || 0;
    const evaluatedSubmissions = challenge.submissions?.filter(s => !!s.evaluation).length || 0;
    return { totalSubmissions, evaluatedSubmissions };
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {currentUser.role === Role.MANAGER && batchId && (
        <BackButton to={`/batch/${batchId}/level/4/manager`} text="Back to Manager Dashboard" />
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
                    <Link to={`/batch/${batchId}/level/4/evaluator/challenge/${challenge.id}/evaluate`}>
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
              <p className="text-gray-500">You have no challenges assigned for evaluation in this batch.</p>
          </Card>
      )}
    </div>
  );
};
