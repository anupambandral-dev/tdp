import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchChallenges = async () => {
      if (!batchId) return;
      
      // With RLS policies in place, we can simplify this fetch significantly.
      // The database will automatically filter the sub-challenges to only those
      // the current user (manager or evaluator) is allowed to see. We just need
      // to join to filter by the batch ID.
      const { data, error } = await supabase
        .from('sub_challenges')
        .select('*, submissions(*, profiles(*)), overall_challenges!inner(id)')
        .eq('overall_challenges.batch_id', batchId);

      if (error) {
          setError(error.message);
          console.error('Error fetching challenges:', error);
      } else if (data) {
          // The data is already correctly filtered by the RLS policies.
          setAssignedChallenges(data as unknown as SubChallengeForEvaluator[]);
      }
    };
    
    const initialFetch = async () => {
        setLoading(true);
        await fetchChallenges();
        setLoading(false);
    }
    initialFetch();

    // Set up real-time subscription for sub-challenges in the current batch
    const subChallengesChannel = supabase
      .channel(`evaluator-dashboard-sc-${batchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sub_challenges' },
        () => fetchChallenges()
      )
      .subscribe();
      
    // Set up a separate real-time subscription for submissions in the current batch
    const submissionsChannel = supabase
      .channel(`evaluator-dashboard-submissions-${batchId}`)
       .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        () => fetchChallenges()
      )
      .subscribe();


    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(subChallengesChannel);
      supabase.removeChannel(submissionsChannel);
    };
  }, [currentUser.id, currentUser.role, batchId]);

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
      <h1 className="text-3xl font-bold mb-6">Evaluation Queue</h1>
      
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
