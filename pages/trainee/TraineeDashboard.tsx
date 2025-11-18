

import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Profile, EvaluationRules, Submission, SubChallengeWithOverallChallenge } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { calculateScore } from '../../utils/score';

interface TraineeDashboardProps {
  currentUser: Profile;
}

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
);

export const TraineeDashboard: React.FC<TraineeDashboardProps> = ({ currentUser }) => {
  const { batchId } = useParams<{ batchId: string }>();
  const [traineeChallenges, setTraineeChallenges] = useState<SubChallengeWithOverallChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChallenges = async () => {
      if (!batchId) return;

      const { data: overallChallenges, error: ocError } = await supabase
        .from('overall_challenges')
        .select('id')
        .eq('batch_id', batchId!)
        .contains('trainee_ids', [currentUser.id]);

      if (ocError) {
        setError(ocError.message);
        return;
      }

      const challengeIds = overallChallenges ? overallChallenges.map(oc => oc.id) : [];

      if (challengeIds.length === 0) {
        setTraineeChallenges([]);
        setLoading(false);
        return;
      }

      const { data, error: scError } = await supabase
        .from('sub_challenges')
        .select('*, submissions(*, profiles(id, name, email, role)), overall_challenges(id, ended_at)')
        .in('overall_challenge_id', challengeIds);

      if (scError) {
        setError(scError.message);
      } else if (data) {
        const sortedData = (data as unknown as SubChallengeWithOverallChallenge[]).sort((a, b) =>
            a.title.localeCompare(b.title, undefined, { numeric: true })
        );
        setTraineeChallenges(sortedData);
      }
    };

    const initialFetch = async () => {
        setLoading(true);
        await fetchChallenges();
        setLoading(false);
    }
    initialFetch();
    
    const channel = supabase
      .channel(`trainee-dashboard-${batchId}-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sub_challenges' },
        () => fetchChallenges()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'overall_challenges' },
        () => fetchChallenges()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        (payload) => {
            const submission = payload.new as Submission;
            if (submission.trainee_id === currentUser.id) {
                fetchChallenges();
            }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id, batchId]);

  const getStatus = (challenge: SubChallengeWithOverallChallenge) => {
    const submission = challenge.submissions?.find(s => s.trainee_id === currentUser.id);
    const rules = challenge.evaluation_rules as unknown as EvaluationRules;
    const reportSubmitted = !!(submission?.report_file);

    const resultsEndTime = new Date(challenge.submission_end_time);
    const reportEndTime = (rules.report.enabled && challenge.report_end_time) ? new Date(challenge.report_end_time) : null;
    const now = new Date();
    
    if (challenge.overall_challenges?.ended_at) {
        return 'Ended';
    }

    // 1. Check if results can be submitted
    if (resultsEndTime > now) {
        return submission ? 'Submitted' : 'Active';
    }

    // 2. Results deadline has passed. Check for report status.
    if (rules.report.enabled && reportEndTime && reportEndTime > now) {
        if (!reportSubmitted) {
            return 'Report Due';
        }
    }

    // 3. All deadlines have passed or work is complete.
    return submission ? 'Submitted' : 'Ended';
  };

  const getDeadlineDisplay = (challenge: SubChallengeWithOverallChallenge) => {
    const resultsEndTime = new Date(challenge.submission_end_time);
    const rules = challenge.evaluation_rules as unknown as EvaluationRules;
    const reportEndTime = (rules.report.enabled && challenge.report_end_time) ? new Date(challenge.report_end_time) : null;
    const now = new Date();

    if (resultsEndTime > now) {
        return `Results Due: ${resultsEndTime.toLocaleString()}`;
    }
    if (reportEndTime && reportEndTime > now) {
        return `Report Due: ${reportEndTime.toLocaleString()}`;
    }
    return `Ended: ${resultsEndTime.toLocaleString()}`;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Trainee Dashboard</h1>
      
      {loading && <p>Loading challenges...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {traineeChallenges.map((challenge) => {
            const status = getStatus(challenge);
            const submission = challenge.submissions?.find(s => s.trainee_id === currentUser.id);
            const scoresPublished = !!challenge.scores_published_at;
            const score = scoresPublished ? (submission?.evaluation ? calculateScore(submission, challenge) : 'N/A') : 'Pending Publication';
            const deadlineDisplay = getDeadlineDisplay(challenge);
            
            return (
               <Link to={`/batch/${batchId}/level/4/trainee/sub-challenge/${challenge.id}`} key={challenge.id} className="block">
                <Card className="h-full flex flex-col hover:shadow-xl transition-shadow duration-200">
                  <div className="flex-grow">
                    <div className="flex justify-between items-start">
                        <h2 className="text-xl font-semibold">{challenge.title}</h2>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            status === 'Active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            status === 'Submitted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            status === 'Report Due' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                            {status}
                        </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">Patent: {challenge.patent_number}</p>
                    <div className="mt-4 text-sm text-gray-500 dark:text-gray-300 flex items-center">
                        <ClockIcon />
                        {deadlineDisplay}
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-300 flex items-center">
                      Score: <span className="font-bold ml-2">{score}</span>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="w-full text-center py-2 px-4 rounded-md font-semibold bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        View Details
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
       {!loading && traineeChallenges.length === 0 && (
          <Card className="text-center py-10">
              <p className="text-gray-500">You haven't been assigned to any challenges in this batch yet.</p>
          </Card>
      )}
    </div>
  );
};
