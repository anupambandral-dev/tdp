import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Profile, Role, SubChallenge, OverallChallenge, Submission, IncorrectMarking, ResultTier, Evaluation, EvaluationRules, SubChallengeWithSubmissions, SubmittedResult, ResultType } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';

interface SubChallengeDetailProps {
    currentUser: Profile;
}

const getTotalScore = (submission: Submission, subChallenge: SubChallenge) => {
    const evaluation = submission.evaluation as unknown as Evaluation | null;
    const results = submission.results as unknown as SubmittedResult[] | null;
    if (!evaluation || !results) return { score: 0 };
    
    const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;
    let totalScore = 0;

    results.forEach(result => {
        const resultEvaluation = evaluation.result_evaluations.find(re => re.result_id === result.id);
        if (resultEvaluation) {
            if (result.trainee_tier === resultEvaluation.evaluator_tier) {
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
    });

    if (rules.report.enabled && evaluation.report_score) {
        totalScore += evaluation.report_score;
    }
    return { score: Math.round(totalScore) };
}

// Manager's view of all submissions
const ManagerView: React.FC<{ subChallenge: SubChallengeWithSubmissions }> = ({ subChallenge }) => {
    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4">Submissions Overview</h2>
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trainee</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted At</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {subChallenge.submissions?.map(submission => {
                                const trainee = submission.profiles;
                                const { score } = getTotalScore(submission, subChallenge);
                                return (
                                    <tr key={submission.trainee_id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {trainee?.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(submission.submitted_at).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {submission.evaluation ? (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Evaluated</span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{submission.evaluation ? score : 'N/A'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

interface TraineeViewProps {
    subChallenge: SubChallengeWithSubmissions;
    overallChallenge: OverallChallenge;
    currentUser: Profile;
}

// Trainee's view of their own submission
const TraineeView: React.FC<TraineeViewProps> = ({ subChallenge, overallChallenge, currentUser }) => {
    const submission = subChallenge.submissions?.find(s => s.trainee_id === currentUser.id);
    const [reportUrl, setReportUrl] = useState<string | null>(null);

    useEffect(() => {
        const generateUrl = async () => {
            if (submission?.report_file) {
                const reportPath = (submission.report_file as { path: string }).path;
                const { data, error } = await supabase.storage
                    .from('reports')
                    .createSignedUrl(reportPath, 60 * 5); // URL valid for 5 minutes

                if (error) {
                    console.error("Error creating signed URL:", error);
                } else {
                    setReportUrl(data.signedUrl);
                }
            }
        };

        generateUrl();
    }, [submission]);
    
    const isChallengeActive = !overallChallenge.ended_at && new Date(subChallenge.submission_end_time) > new Date();

    if (!submission) {
        if (isChallengeActive) {
            return (
                <Card className="text-center py-10">
                    <h2 className="text-xl font-semibold mb-2">Ready to start?</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">You have not made a submission for this challenge yet.</p>
                    <Link to={`/trainee/challenge/${subChallenge.id}/submit`}>
                        <Button>Submit Your Results Now</Button>
                    </Link>
                </Card>
            );
        } else {
            return (
                <Card className="text-center py-10">
                    <h2 className="text-xl font-semibold mb-2">Submission Closed</h2>
                    <p className="text-gray-600 dark:text-gray-400">You did not make a submission for this challenge before the deadline.</p>
                </Card>
            );
        }
    }
    
    const { score } = getTotalScore(submission, subChallenge);
    const evaluation = submission.evaluation as unknown as Evaluation | null;
    const results = submission.results as unknown as SubmittedResult[] | null;
    const reportFile = submission.report_file as { name: string; path: string; } | null;
    const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;


    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
                <h2 className="text-2xl font-semibold mb-4">Your Submission</h2>
                <Card className="space-y-4">
                  {results?.map(result => (
                    <div key={result.id} className="p-2 border-b dark:border-gray-700">
                      <p className="font-mono text-sm">{result.value}</p>
                      <p className="text-xs text-gray-500">{result.type} - Submitted as {result.trainee_tier}</p>
                    </div>
                  ))}
                  {reportFile && (
                      <div>
                          <h3 className="font-semibold text-md">Submitted Report</h3>
                           {reportUrl ? (
                               <a href={reportUrl} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{reportFile.name}</a>
                           ) : (
                               <p className="text-gray-500 text-sm">Generating secure link...</p>
                           )}
                      </div>
                  )}
                </Card>
            </div>
            <div>
                <h2 className="text-2xl font-semibold mb-4">Evaluation Result</h2>
                {evaluation ? (
                    <Card>
                        <div className="mb-4 pb-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-semibold">Final Score</h3>
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{score}</p>
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Result Breakdown</h3>
                        <div className="space-y-2 mb-4">
                           {results?.map(result => {
                                const evalResult = evaluation.result_evaluations.find(e => e.result_id === result.id);
                                if (!evalResult) return null;
                                const isCorrect = evalResult.evaluator_tier === result.trainee_tier;
                                return (
                                <div key={result.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm">
                                    <p className="font-mono truncate">{result.value}</p>
                                    <div className="flex justify-between items-center">
                                      <p>Your Tier: <span className="font-semibold">{result.trainee_tier}</span></p>
                                      <p>Evaluator Tier: <span className="font-semibold">{evalResult.evaluator_tier}</span></p>
                                      {isCorrect ? <span className="text-green-500 font-bold">Correct</span> : <span className="text-orange-500 font-bold">Incorrect</span>}
                                    </div>
                                </div>
                                )
                           })}
                        </div>
                         {rules.report.enabled && (
                            <div className="flex justify-between items-center text-sm mb-4">
                               <span className="font-semibold">Report Score:</span>
                               <span>{evaluation.report_score || 0} / {rules.report.maxScore}</span>
                            </div>
                         )}
                         <h3 className="text-lg font-semibold mb-2">Evaluator Feedback</h3>
                         <p className="text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 p-3 rounded-md">{evaluation.feedback}</p>
                    </Card>
                ) : (
                    <Card className="text-center py-10">
                        <p className="text-gray-500">Your submission has not been evaluated yet.</p>
                    </Card>
                )}
            </div>
        </div>
    );
};

export const SubChallengeDetail: React.FC<SubChallengeDetailProps> = ({ currentUser }) => {
    const { subChallengeId } = useParams<{ subChallengeId: string }>();
    const [subChallenge, setSubChallenge] = useState<SubChallengeWithSubmissions | null>(null);
    const [overallChallenge, setOverallChallenge] = useState<OverallChallenge | null>(null);
    const [evaluators, setEvaluators] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!subChallengeId) return;
            setLoading(true);
            const { data: scData, error: scError } = await supabase
                .from('sub_challenges')
                .select('*, submissions(*, profiles(id, name, avatar_url, email, role))')
                .eq('id', subChallengeId)
                .single<SubChallengeWithSubmissions>();
            
            if (scError) {
                console.error(scError);
                setLoading(false);
                return;
            }

            if (scData) {
                setSubChallenge(scData);

                const overallChallengePromise = supabase
                    .from('overall_challenges')
                    .select('*')
                    .eq('id', scData.overall_challenge_id)
                    .single();

                const evaluatorsPromise = (scData.evaluator_ids && scData.evaluator_ids.length > 0)
                    ? supabase.from('profiles').select('*').in('id', scData.evaluator_ids)
                    : Promise.resolve({ data: [], error: null });

                const [ocResult, evaluatorsResult] = await Promise.all([overallChallengePromise, evaluatorsPromise]);
                
                if (ocResult.error) {
                    console.error(ocResult.error);
                } else if (ocResult.data) {
                    setOverallChallenge(ocResult.data as unknown as OverallChallenge);
                }

                if (evaluatorsResult.error) {
                    console.error('Error fetching evaluators:', evaluatorsResult.error);
                } else if (evaluatorsResult.data) {
                    setEvaluators(evaluatorsResult.data as Profile[]);
                }
            }
            setLoading(false);
        };
        fetchDetails();
    }, [subChallengeId]);


    if (loading) return <div className="p-8">Loading details...</div>;
    if (!subChallenge || !overallChallenge) {
        return <div className="text-center p-8">Challenge not found.</div>;
    }

    const backLink = currentUser.role === Role.MANAGER ? `/manager/challenge/${overallChallenge.id}` : '/trainee';
    const backLinkText = currentUser.role === Role.MANAGER ? 'Back to Challenge Details' : 'Back to Dashboard';

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to={backLink} text={backLinkText} />
            
            <Card className="mb-8">
                <h1 className="text-3xl font-bold">{subChallenge.title}</h1>
                <p className="text-gray-500 dark:text-gray-400">Part of "{overallChallenge.name}"</p>
                <div className="mt-4 border-t dark:border-gray-700 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="font-semibold">Results Deadline</p>
                        <p>{new Date(subChallenge.submission_end_time).toLocaleString()}</p>
                    </div>
                    {subChallenge.report_end_time && (
                        <div>
                            <p className="font-semibold">Report Deadline</p>
                            <p>{new Date(subChallenge.report_end_time).toLocaleString()}</p>
                        </div>
                    )}
                    <div>
                        <p className="font-semibold">Patent Number</p>
                        <p>{subChallenge.patent_number}</p>
                    </div>
                     <div>
                        <p className="font-semibold">Summary</p>
                        <p>{subChallenge.summary}</p>
                    </div>
                     <div>
                        <p className="font-semibold">Claim Focus</p>
                        <p>{subChallenge.claim_focus}</p>
                    </div>
                </div>
                 {evaluators.length > 0 && (
                    <div className="mt-4 border-t dark:border-gray-700 pt-4">
                        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Assigned Evaluators</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {evaluators.map(evaluator => (
                                <span key={evaluator.id} className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                    {evaluator.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </Card>

            {currentUser.role === Role.MANAGER && <ManagerView subChallenge={subChallenge} />}
            {currentUser.role === Role.TRAINEE && <TraineeView subChallenge={subChallenge} overallChallenge={overallChallenge} currentUser={currentUser} />}
        </div>
    );
};
