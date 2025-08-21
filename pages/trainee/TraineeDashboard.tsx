import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Profile, SubChallenge, ResultTier, IncorrectMarking } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface TraineeDashboardProps {
  currentUser: Profile;
}

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
);

export const TraineeDashboard: React.FC<TraineeDashboardProps> = ({ currentUser }) => {
  const [traineeChallenges, setTraineeChallenges] = useState<SubChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChallenges = async () => {
      setLoading(true);
      // 1. Find overall challenges for this trainee
      const { data: overallChallenges, error: ocError } = await supabase
        .from('overall_challenges')
        .select('id')
        .contains('trainee_ids', [currentUser.id]);

      if (ocError) {
        setError(ocError.message);
        setLoading(false);
        return;
      }

      if (overallChallenges.length === 0) {
        setTraineeChallenges([]);
        setLoading(false);
        return;
      }

      // 2. Fetch sub-challenges related to those overall challenges
      const challengeIds = overallChallenges.map(oc => oc.id);
      const { data, error: scError } = await supabase
        .from('sub_challenges')
        .select('*, submissions(*)')
        .in('overall_challenge_id', challengeIds);

      if (scError) {
        setError(scError.message);
      } else {
        setTraineeChallenges((data as any) || []);
      }
      setLoading(false);
    };

    fetchChallenges();
  }, [currentUser.id]);

  const getStatus = (challenge: SubChallenge) => {
    const endTime = new Date(challenge.submission_end_time);
    const submission = challenge.submissions?.find(s => s.trainee_id === currentUser.id);
    if (submission) return 'Submitted';
    if (endTime < new Date()) return 'Ended';
    return 'Active';
  };
  
  const getScore = (challenge: SubChallenge) => {
    const submission = challenge.submissions?.find(s => s.trainee_id === currentUser.id);
    if (!submission?.evaluation) return 'N/A';
    
    const rules = challenge.evaluation_rules;
    let totalScore = 0;

    submission.results.forEach(result => {
      const evaluation = submission.evaluation?.result_evaluations.find(re => re.result_id === result.id);
      if (evaluation) {
        if (result.trainee_tier === evaluation.evaluator_tier) {
          totalScore += rules.tierScores[result.trainee_tier as ResultTier] || 0;
        } else {
          if (rules.incorrectMarking === IncorrectMarking.PENALTY) {
            totalScore += rules.incorrectPenalty;
          }
        }
      }
    });

    if (rules.report.enabled && submission.evaluation?.report_score) {
      totalScore += submission.evaluation.report_score;
    }
    
    return `${Math.round(totalScore)}`;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Trainee Dashboard</h1>
      
      {loading && <p>Loading challenges...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {traineeChallenges.map((challenge) => {
            const status = getStatus(challenge);
            const score = getScore(challenge);
            return (
              <Card key={challenge.id}>
                <div className="flex justify-between items-start">
                    <h2 className="text-xl font-semibold">{challenge.title}</h2>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        status === 'Active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        status === 'Submitted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                        {status}
                    </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">Patent: {challenge.patent_number}</p>
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-300 flex items-center">
                    <ClockIcon />
                    Ends: {new Date(challenge.submission_end_time).toLocaleString()}
                </div>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-300 flex items-center">
                  Score: <span className="font-bold ml-2">{score}</span>
                </div>
                <div className="mt-6">
                  {status === 'Active' ? (
                    <Link to={`/trainee/challenge/${challenge.id}/submit`}>
                      <Button className="w-full">Submit Results</Button>
                    </Link>
                  ) : status === 'Submitted' ? (
                     <Link to={`/trainee/sub-challenge/${challenge.id}`}>
                      <Button className="w-full" variant="secondary">View Submission</Button>
                    </Link>
                  ) : (
                    <Button className="w-full" disabled>
                      Submission Closed
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
       {!loading && traineeChallenges.length === 0 && (
          <Card className="text-center py-10">
              <p className="text-gray-500">You haven't been assigned to any challenges yet.</p>
          </Card>
      )}
    </div>
  );
};
