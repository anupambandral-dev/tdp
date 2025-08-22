

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Profile, SubChallenge, SubChallengeWithSubmissions } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface EvaluatorDashboardProps {
  currentUser: Profile;
}

export const EvaluatorDashboard: React.FC<EvaluatorDashboardProps> = ({ currentUser }) => {
  const [assignedChallenges, setAssignedChallenges] = useState<SubChallengeWithSubmissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChallenges = async () => {
        setLoading(true);
        const { data: overallChallengesData, error: ocError } = await supabase
          .from('overall_challenges')
          .select('id')
          .contains('evaluator_ids', [currentUser.id])
          .returns<{ id: string }[]>();

        if (ocError) {
          setError(ocError.message);
          setLoading(false);
          return;
        }

        const overallChallenges = overallChallengesData || [];

        if (overallChallenges.length === 0) {
          setAssignedChallenges([]);
          setLoading(false);
          return;
        }

        const challengeIds = overallChallenges.map(oc => oc.id);
        const { data: subChallenges, error: scError } = await supabase
            .from('sub_challenges')
            .select('*, submissions(*, profiles(*))')
            .in('overall_challenge_id', challengeIds)
            .returns<SubChallengeWithSubmissions[]>();

        if (scError) {
            setError(scError.message);
        } else if (subChallenges) {
            setAssignedChallenges(subChallenges);
        }
        setLoading(false);
    };

    fetchChallenges();
  }, [currentUser.id]);

  const getEvaluationStats = (challenge: SubChallengeWithSubmissions) => {
    const totalSubmissions = challenge.submissions?.length || 0;
    const evaluatedSubmissions = challenge.submissions?.filter(s => !!s.evaluation).length || 0;
    return { totalSubmissions, evaluatedSubmissions };
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Evaluator Dashboard</h1>
      
      {loading && <p>Loading evaluation queue...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div className="space-y-6">
          {assignedChallenges.map((challenge) => {
              const { totalSubmissions, evaluatedSubmissions } = getEvaluationStats(challenge);
              const progress = totalSubmissions > 0 ? (evaluatedSubmissions / totalSubmissions) * 100 : 0;
              return (
              <Card key={challenge.id}>
                <div className="md:flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold">{challenge.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Due: {new Date(challenge.submission_end_time).toLocaleDateString()}</p>
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