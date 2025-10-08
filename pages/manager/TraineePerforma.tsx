import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';
import { SubChallenge, Submission, IncorrectMarking, ResultTier, OverallChallenge, Profile, EvaluationRules, SubmittedResult, Evaluation, ResultType } from '../../types';

const getTotalScore = (submission: Submission, subChallenge: SubChallenge) => {
    const evaluation = submission.evaluation as unknown as Evaluation | null;
    const results = submission.results as unknown as SubmittedResult[] | null;
    if (!evaluation || !results) return { score: 0 };
    
    const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;
    let totalScore = 0;

    results.forEach(result => {
        const resultEvaluation = evaluation.result_evaluations.find(re => re.result_id === result.id);
        if (resultEvaluation) {
            if (resultEvaluation.score_override != null) {
                totalScore += resultEvaluation.score_override;
            } else {
                // FIX: Cast for enum comparison
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
    return { score: Math.round(totalScore) };
}

interface FetchedOverallChallenge extends OverallChallenge {
    sub_challenges: (SubChallenge & { submissions: Submission[] })[];
}

const ReportLink: React.FC<{ reportFile: { name: string; path: string } | null }> = ({ reportFile }) => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (reportFile?.path) {
            const getUrl = async () => {
                const { data, error } = await supabase.storage
                    .from('reports')
                    .createSignedUrl(reportFile.path, 60 * 5); // 5 minutes
                if (error) {
                    console.error("Error creating signed URL:", error);
                } else {
                    setUrl(data.signedUrl);
                }
            };
            getUrl();
        }
    }, [reportFile]);

    if (!reportFile) return null;

    if (!url) return <p className="text-gray-500 text-sm">Generating secure link...</p>;

    return (
        <a href={url} className="text-blue-600 dark:text-blue-400 hover:underline text-sm" target="_blank" rel="noopener noreferrer">
            {reportFile.name}
        </a>
    );
};


export const TraineePerforma: React.FC = () => {
    const { batchId, challengeId, traineeId } = useParams<{ batchId: string; challengeId: string; traineeId: string }>();
    const [overallChallenge, setOverallChallenge] = useState<FetchedOverallChallenge | null>(null);
    const [trainee, setTrainee] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!challengeId || !traineeId) return;
            setLoading(true);

            // Fetch Trainee Profile
            const { data: traineeData, error: traineeError } = await supabase.from('profiles').select('*').eq('id', traineeId).single();
            if (traineeError) console.error(traineeError);
            if (traineeData) setTrainee(traineeData as unknown as Profile);

            // Fetch Overall Challenge with its sub-challenges and only this trainee's submissions
            // The !inner hint ensures sub_challenges are only returned if they have a matching submission
            const { data: challengeData, error } = await supabase
                .from('overall_challenges')
                .select('*, sub_challenges!inner(*, submissions!inner(*))')
                .eq('id', challengeId)
                .eq('sub_challenges.submissions.trainee_id', traineeId)
                .single();
            
            if (error && error.code !== 'PGRST116') { // Ignore 'PGRST116' (single row not found) if trainee has no submissions
                console.error(error);
            } else if (challengeData) {
                setOverallChallenge(challengeData as unknown as FetchedOverallChallenge);
            } else {
                // If no data, fetch the challenge shell without submissions to show 'Not Submitted'
                const { data: shellData } = await supabase
                    .from('overall_challenges')
                    .select('*, sub_challenges(*)')
                    .eq('id', challengeId)
                    .single();
                if (shellData) {
                    const typedShellData = shellData as unknown as (OverallChallenge & { sub_challenges: SubChallenge[] });
                    const challengeWithEmptySubmissions = {
                        ...typedShellData,
                        sub_challenges: typedShellData.sub_challenges.map(sc => ({...sc, submissions: []}))
                    }
                    setOverallChallenge(challengeWithEmptySubmissions as unknown as FetchedOverallChallenge);
                }
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
            <BackButton to={`/batch/${batchId}/level/4/challenge/${challengeId}`} text="Back to Leaderboard" />

            <div className="mb-8">
                <h1 className="text-3xl font-bold">{trainee.name}</h1>
                <p className="text-gray-500 dark:text-gray-400">Performance in "{overallChallenge.name}"</p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-semibold border-b pb-2 dark:border-gray-700">Sub-Challenge Performance</h2>
                {overallChallenge.sub_challenges.map(subChallenge => {
                    const submission = subChallenge.submissions?.find(s => s.trainee_id === traineeId);
                    const evaluation = submission?.evaluation as unknown as Evaluation | null;
                    const results = submission?.results as unknown as SubmittedResult[] | null;
                    const reportFile = submission?.report_file as { name: string; path: string } | null;
                    const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;

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
                                                {results?.map(r => (
                                                    <div key={r.id} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-xs">
                                                        <p className="font-mono truncate">{r.value}</p>
                                                        <p>{r.type} - Submitted as {r.trainee_tier}</p>
                                                        {r.submitted_at && <p className="text-gray-500">Submitted: {new Date(r.submitted_at).toLocaleString()}</p>}
                                                    </div>
                                                ))}
                                                </div>
                                            </div>
                                            {reportFile && (
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Report File:</p>
                                                    <ReportLink reportFile={reportFile} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold">Evaluation</h4>
                                        {evaluation ? (
                                            <div className="mt-2 space-y-3">
                                                <div className="flex justify-between items-baseline pb-2 border-b dark:border-gray-700">
                                                    <span className="font-bold">Total Score:</span>
                                                    <span className="text-xl font-bold">{getTotalScore(submission, subChallenge).score}</span>
                                                </div>
                                                <ul className="space-y-1 text-sm pt-2">
                                                    {evaluation.result_evaluations.map(re => {
                                                        const result = results?.find(r => r.id === re.result_id);
                                                        if (!result) return null;
                                                        // FIX: Cast for enum comparison
                                                        const isCorrect = result.trainee_tier === (re.evaluator_tier as any);
                                                        return (
                                                        <li key={re.result_id} className="flex justify-between p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                                                            <span className="font-mono text-xs truncate w-3/5">{result.value}</span>
                                                            <span className={isCorrect ? 'text-green-500' : 'text-orange-500'}>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                                                        </li>
                                                        )
                                                    })}
                                                </ul>
                                                {rules.report.enabled && (
                                                    <p className="text-sm">Report Score: <strong>{evaluation.report_score} / {rules.report.maxScore}</strong></p>
                                                )}
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Feedback:</p>
                                                    <p className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm">{evaluation.feedback}</p>
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