import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Card } from '../components/ui/Card';
import { OverallChallenge, SubChallenge, Profile, Submission, IncorrectMarking, ResultTier, Evaluation, EvaluationRules, SubmittedResult, ResultType } from '../types';

// This logic is duplicated from other components. In a real-world refactor, it would move to a shared utils file.
const calculateSubChallengeScore = (submission: Submission, subChallenge: SubChallenge) => {
    const evaluation = submission.evaluation as unknown as Evaluation | null;
    const results = submission.results as unknown as SubmittedResult[] | null;
    if (!evaluation || !results) return 0;
    
    const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;
    let totalScore = 0;

    results.forEach(result => {
        const resultEvaluation = evaluation.result_evaluations.find(re => re.result_id === result.id);
        if (resultEvaluation) {
            if (resultEvaluation.score_override != null) {
                totalScore += resultEvaluation.score_override;
            } else {
                if (result.trainee_tier === (resultEvaluation.evaluator_tier as any)) {
                    const resultTypeScores = rules.tierScores[result.type as ResultType];
                    if (resultTypeScores) {
                        totalScore += resultTypeScores[result.trainee_tier as ResultTier] || 0;
                    }
                } else {
                    if (rules.incorrectMarking === IncorrectMarking.PENALTY) {
                        totalScore += rules.incorrectPenalty;
                    }
                }
            }
        }
    });

    if (rules.report.enabled && evaluation.report_score) {
        totalScore += evaluation.report_score;
    }
    return Math.round(totalScore);
}

const TrophyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-yellow-400"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
);

interface ChallengeWithSubChallengesAndSubmissions extends OverallChallenge {
    sub_challenges: (SubChallenge & { submissions: Submission[] })[];
}

export const PublicLeaderboard: React.FC = () => {
    const { challengeId } = useParams<{ challengeId: string }>();
    const [challenge, setChallenge] = useState<ChallengeWithSubChallengesAndSubmissions | null>(null);
    const [trainees, setTrainees] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPublicLeaderboard = async () => {
            if (!challengeId) {
                setError("No challenge ID provided.");
                setLoading(false);
                return;
            }
            setLoading(true);

            const { data, error } = await supabase
                .from('overall_challenges')
                .select('*, sub_challenges(*, submissions(*))')
                .eq('id', challengeId)
                .single<ChallengeWithSubChallengesAndSubmissions>();
            
            if (error) {
                setError(error.message);
                console.error(error);
            } else if (data) {
                setChallenge(data);
                if (data.trainee_ids.length > 0) {
                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, name') // Only fetch public info
                        .in('id', data.trainee_ids);

                    if (profilesError) {
                        setError(profilesError.message);
                    } else if (profilesData) {
                        setTrainees(profilesData as unknown as Profile[]);
                    }
                }
            }
            setLoading(false);
        };
        fetchPublicLeaderboard();
    }, [challengeId]);

    const getTraineeScore = (traineeId: string) => {
        if (!challenge) return 0;
        let totalScore = 0;
        challenge.sub_challenges.forEach(sc => {
            const submission = sc.submissions?.find(s => s.trainee_id === traineeId);
            // Only count scores for evaluated submissions
            if (submission && submission.evaluation) {
                totalScore += calculateSubChallengeScore(submission, sc);
            }
        });
        return totalScore;
    };

    const leaderboardData = trainees
        .map(user => ({ user, score: getTraineeScore(user.id) }))
        .sort((a, b) => b.score - a.score);
    
    const getMedal = (index: number) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return null;
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900"><p className="text-gray-500">Loading leaderboard...</p></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center p-4 bg-red-100 dark:bg-red-900"><p>Error: {error}</p></div>;
    if (!challenge) return <div className="min-h-screen flex items-center justify-center p-4"><p>Challenge not found.</p></div>;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
            <main className="w-full max-w-2xl">
                <Card>
                    <div className="text-center mb-6">
                        <div className="flex justify-center items-center gap-3">
                           <TrophyIcon />
                           <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{challenge.name}</h1>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Public Leaderboard</p>
                    </div>
                    
                    <div className="flow-root">
                        <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700">
                            {leaderboardData.map(({ user, score }, index) => (
                                <li key={user.id} className="py-3 sm:py-4">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-shrink-0 w-8 text-center text-lg font-bold text-gray-500 dark:text-gray-400">
                                            {getMedal(index) || index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate dark:text-white">
                                                {user.name}
                                            </p>
                                        </div>
                                        <div className="inline-flex items-center text-base font-semibold text-gray-900 dark:text-white">
                                            {score} pts
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </Card>
                 <footer className="text-center mt-4">
                    <p className="text-xs text-gray-500">Tour de Prior Art</p>
                </footer>
            </main>
        </div>
    );
};
