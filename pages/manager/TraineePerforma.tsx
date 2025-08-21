import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { SubChallenge, Submission, IncorrectMarking, ResultTier, OverallChallenge, Profile } from '../../types';

const getTotalScore = (submission: Submission, subChallenge: SubChallenge) => {
    if (!submission.evaluation) return { score: 0 };
    const rules = subChallenge.evaluation_rules;
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
    return { score: Math.round(totalScore) };
}

interface FetchedOverallChallenge extends OverallChallenge {
    sub_challenges: (SubChallenge & { submissions: Submission[] })[];
}

export const TraineePerforma: React.FC = () => {
    const { challengeId, traineeId } = useParams<{ challengeId: string; traineeId: string }>();
    const [overallChallenge, setOverallChallenge] = useState<FetchedOverallChallenge | null>(null);
    const [trainee, setTrainee] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!challengeId || !traineeId) return;
            setLoading(true);

            // Fetch Trainee Profile
            const { data: traineeData } = await supabase.from('profiles').select('*').eq('id', traineeId).single();
            setTrainee(traineeData);

            // Fetch Overall Challenge with its sub-challenges and only this trainee's submissions
            const { data: challengeData, error } = await supabase
                .from('overall_challenges')
                .select('*, sub_challenges(*, submissions(*))')
                .eq('id', challengeId)
                .eq('sub_challenges.submissions.trainee_id', traineeId)
                .single();
            
            if (challengeData) {
                setOverallChallenge(challengeData as FetchedOverallChallenge);
            }
            setLoading(false);
        };
        fetchData();
    }, [challengeId, traineeId]);

    if (loading) return <div className="p-8">Loading trainee performa...</div>;
    if (!overallChallenge || !trainee) {
        return <div className="text-center p-8">Trainee or Challenge not found.</div>;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <Link to={`/manager/challenge/${challengeId}`} className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">
                &larr; Back to Leaderboard
            </Link>

            <div className="flex items-center space-x-4 mb-8">
                <img src={trainee.avatar_url} alt={trainee.name} className="w-20 h-20 rounded-full" />
                <div>
                    <h1 className="text-3xl font-bold">{trainee.name}</h1>
                    <p className="text-gray-500 dark:text-gray-400">Performance in "{overallChallenge.name}"</p>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-semibold border-b pb-2 dark:border-gray-700">Sub-Challenge Performance</h2>
                {overallChallenge.sub_challenges.map(subChallenge => {
                    const submission = subChallenge.submissions[0]; // We filtered to only get one
                    return (
                        <Card key={subChallenge.id}>
                            <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400">{subChallenge.title}</h3>
                            {!submission ? (
                                <p className="mt-4 text-gray-500 text-center py-4">Not Submitted</p>
                            ) : (
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-semibold">Submission Details</h4>
                                        <div className="mt-2 space-y-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Results:</p>
                                                <div className="space-y-2 mt-1">
                                                {submission.results.map(r => (
                                                    <div key={r.id} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-xs">
                                                        <p className="font-mono truncate">{r.value}</p>
                                                        <p>{r.type} - Submitted as {r.trainee_tier}</p>
                                                    </div>
                                                ))}
                                                </div>
                                            </div>
                                            {submission.report_file && (
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Report File:</p>
                                                    <a href={supabase.storage.from('reports').getPublicUrl(submission.report_file.path).data.publicUrl} className="text-blue-600 dark:text-blue-400 hover:underline text-sm" target="_blank" rel="noopener noreferrer">{submission.report_file.name}</a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold">Evaluation</h4>
                                        {submission.evaluation ? (
                                            <div className="mt-2 space-y-3">
                                                <div className="flex justify-between items-baseline pb-2 border-b dark:border-gray-700">
                                                    <span className="font-bold">Total Score:</span>
                                                    <span className="text-xl font-bold">{getTotalScore(submission, subChallenge).score}</span>
                                                </div>
                                                <ul className="space-y-1 text-sm pt-2">
                                                    {submission.evaluation.result_evaluations.map(re => {
                                                        const result = submission.results.find(r => r.id === re.result_id);
                                                        if (!result) return null;
                                                        const isCorrect = result.trainee_tier === re.evaluator_tier;
                                                        return (
                                                        <li key={re.result_id} className="flex justify-between p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                                                            <span className="font-mono text-xs truncate w-3/5">{result.value}</span>
                                                            <span className={isCorrect ? 'text-green-500' : 'text-orange-500'}>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                                                        </li>
                                                        )
                                                    })}
                                                </ul>
                                                {subChallenge.evaluation_rules.report.enabled && (
                                                    <p className="text-sm">Report Score: <strong>{submission.evaluation.report_score} / {subChallenge.evaluation_rules.report.maxScore}</strong></p>
                                                )}
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Feedback:</p>
                                                    <p className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm">{submission.evaluation.feedback}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-2 text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center h-full">
                                                <p className="text-gray-500 dark:text-gray-400">Pending Evaluation</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
                 {overallChallenge.sub_challenges.length === 0 && (
                    <Card><p className="text-center text-gray-500">No sub-challenges in this challenge yet.</p></Card>
                 )}
            </div>
        </div>
    );
};
