import React, { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Profile, EvaluationRules, Submission, SubChallengeWithOverallChallenge, QuizWithSubmission, QuizStatusEnum } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { calculateScore } from '../../utils/score';

interface TraineeDashboardProps {
  currentUser: Profile;
}

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
);

export const TraineeDashboard: React.FC<TraineeDashboardProps> = ({ currentUser }) => {
  const { batchId } = useParams<{ batchId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [traineeChallenges, setTraineeChallenges] = useState<SubChallengeWithOverallChallenge[]>([]);
  const [quizzes, setQuizzes] = useState<QuizWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'challenges' | 'quizzes'>((searchParams.get('tab') as 'challenges' | 'quizzes') || 'challenges');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'challenges' || tab === 'quizzes') {
        setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'challenges' | 'quizzes') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

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

    const fetchQuizzes = async () => {
        if (!batchId) return;
        const { data, error } = await supabase
            .from('quizzes')
            .select('*, quiz_submissions(id, participant_id)')
            .eq('batch_id', batchId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching quizzes:", error);
        } else {
            setQuizzes(data as unknown as QuizWithSubmission[]);
        }
    };

    const initialFetch = async () => {
        setLoading(true);
        await Promise.all([fetchChallenges(), fetchQuizzes()]);
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quizzes' },
        () => fetchQuizzes()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_submissions' },
        () => fetchQuizzes()
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

  const getTraineeQuizStatus = (quiz: QuizWithSubmission) => {
    const hasSubmitted = quiz.quiz_submissions.some(sub => sub.participant_id === currentUser.id);
    if (hasSubmitted) return { text: "Completed", color: "green", link: null };
    if (quiz.status === QuizStatusEnum.LIVE) return { text: "Take Quiz", color: "blue", link: `/batch/${batchId}/quiz/take/${quiz.id}` };
    if (quiz.status === QuizStatusEnum.DRAFT) return { text: "Not Started", color: "gray", link: null };
    if (quiz.status === QuizStatusEnum.ENDED) return { text: "Ended", color: "red", link: null };
    return { text: "Unavailable", color: "gray", link: null };
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Trainee Dashboard</h1>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => handleTabChange('challenges')}
            className={`${
              activeTab === 'challenges'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Tour de Prior Art Challenges
          </button>
          <button
            onClick={() => handleTabChange('quizzes')}
            className={`${
              activeTab === 'quizzes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Quizzes
          </button>
        </nav>
      </div>
      
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && activeTab === 'challenges' && (
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
          {traineeChallenges.length === 0 && (
            <div className="col-span-full">
                <Card className="text-center py-10">
                    <p className="text-gray-500">You haven't been assigned to any challenges in this batch yet.</p>
                </Card>
            </div>
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'quizzes' && (
        <div className="space-y-4">
            {quizzes.length === 0 ? (
                <Card className="text-center py-10">
                    <p className="text-gray-500 dark:text-gray-400">No quizzes have been created for this batch yet.</p>
                </Card>
            ) : (
                quizzes.map(quiz => {
                    const traineeStatus = getTraineeQuizStatus(quiz);
                    const userSubmission = quiz.quiz_submissions.find(sub => sub.participant_id === currentUser.id);
                    
                    return (
                        <Card key={quiz.id}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-semibold">{quiz.title}</h2>
                                    {userSubmission && (
                                        <Link 
                                            to={`/batch/${batchId}/quiz/submission/${userSubmission.id}`}
                                            className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                                        >
                                            View My Responses
                                        </Link>
                                    )}
                                </div>
                                {traineeStatus.link ? (
                                    <Link to={traineeStatus.link}><Button>{traineeStatus.text}</Button></Link>
                                ) : (
                                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                                        traineeStatus.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-200' :
                                        traineeStatus.color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-200' :
                                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                    }`}>
                                        {traineeStatus.text}
                                    </span>
                                )}
                            </div>
                        </Card>
                    );
                })
            )}
        </div>
      )}
    </div>
  );
};
