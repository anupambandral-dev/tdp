import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Profile, Role, SubChallenge, OverallChallenge, Submission, Evaluation, SubChallengeWithSubmissions, SubmittedResult, EvaluationRules } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { calculateScore } from '../../utils/score';

interface SubChallengeDetailProps {
    currentUser: Profile;
}

interface ManagerViewProps {
    subChallenge: SubChallengeWithSubmissions;
    onPublish: () => void;
    isPublishing: boolean;
}


// Manager's view of all submissions
const ManagerView: React.FC<ManagerViewProps> = ({ subChallenge, onPublish, isPublishing }) => {
    const scoresPublished = !!subChallenge.scores_published_at;
    const allEvaluated = (subChallenge.submissions?.length || 0) > 0 && subChallenge.submissions.every(s => !!s.evaluation);

    return (
        <div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 className="text-2xl font-semibold">Submissions Overview</h2>
                 <Button 
                    onClick={onPublish} 
                    disabled={!allEvaluated || scoresPublished || isPublishing}
                    title={!allEvaluated ? "All submissions must be evaluated before publishing." : scoresPublished ? "Scores have already been published." : ""}
                >
                    {isPublishing ? 'Publishing...' : (scoresPublished ? 'Scores Published' : 'Publish All Scores')}
                </Button>
            </div>
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
                                const score = calculateScore(submission, subChallenge);
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                                             {scoresPublished ? (submission.evaluation ? score : 'N/A') : 'Pending Publication'}
                                        </td>
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
    batchId: string;
    subChallenge: SubChallengeWithSubmissions;
    overallChallenge: OverallChallenge;
    currentUser: Profile;
}

// Trainee's view of their own submission
const TraineeView: React.FC<TraineeViewProps> = ({ batchId, subChallenge, overallChallenge, currentUser }) => {
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
                    <Link to={`/batch/${batchId}/level/4/trainee/challenge/${subChallenge.id}/submit`}>
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
    
    const score = calculateScore(submission, subChallenge);
    const evaluation = submission.evaluation as unknown as Evaluation | null;
    const results = submission.results as unknown as SubmittedResult[] | null;
    const reportFile = submission.report_file as { name: string; path: string; } | null;
    const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;
    const scoresPublished = !!subChallenge.scores_published_at;

    const canSubmitMore = !subChallenge.submission_limit || !results || results.length < subChallenge.submission_limit;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                     <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                        <h2 className="text-2xl font-semibold">Your Submission</h2>
                        {isChallengeActive && (
                            <Link to={`/batch/${batchId}/level/4/trainee/challenge/${subChallenge.id}/submit`}>
                                <Button>{canSubmitMore ? 'Add / Edit Results' : 'Edit Submission'}</Button>
                            </Link>
                        )}
                    </div>
                    <Card>
                        <div className="space-y-4">
                            {(!results || results.length === 0) && !reportFile && (
                                <p className="text-center text-gray-500 py-4">No results or report submitted yet.</p>
                            )}
                            {results && results.length > 0 && (
                                <div>
                                    <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">Submitted Results ({results.length}/{subChallenge.submission_limit ?? 'Unlimited'})</h3>
                                    <div className="mt-2 space-y-2">
                                        {results.map(result => (
                                        <div key={result.id} className="p-2 border-b dark:border-gray-700 last:border-b-0">
                                            <p className="font-mono text-sm">{result.value}</p>
                                            <p className="text-xs text-gray-500">{result.type} - Submitted as {result.trainee_tier}</p>
                                        </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {reportFile && (
                                <div className="pt-4 border-t dark:border-gray-700">
                                    <h3 className="font-semibold text-md text-gray-700 dark:text-gray-300">Submitted Report</h3>
                                    {reportUrl ? (
                                        <a href={reportUrl} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{reportFile.name}</a>
                                    ) : (
                                        <p className="text-gray-500 text-sm">Generating secure link...</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
                <div>
                    <h2 className="text-2xl font-semibold mb-4">Evaluation Result</h2>
                    {scoresPublished && evaluation ? (
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
                                    const isCorrect = (evalResult.evaluator_tier as any) === result.trainee_tier;
                                    return (
                                    <div key={result.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm space-y-2">
                                        <p className="font-mono truncate font-medium">{result.value}</p>
                                        <div className="flex justify-between items-center text-xs flex-wrap gap-2">
                                          <p>Your Tier: <span className="font-semibold bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">{result.trainee_tier}</span></p>
                                          <p>Evaluator Tier: <span className="font-semibold bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">{evalResult.evaluator_tier}</span></p>
                                          {isCorrect ? 
                                            <span className="font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Correct</span> : 
                                            <span className="font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Changed</span>
                                          }
                                        </div>
                                        {evalResult.override_reason && (
                                            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 flex-shrink-0 mt-0.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                                    <span className="italic">{evalResult.override_reason}</span>
                                                </p>
                                            </div>
                                        )}
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
                             <p className="text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 p-3 rounded-md">{evaluation.feedback || "No feedback provided."}</p>
                        </Card>
                    ) : (
                        <Card className="text-center py-10">
                            <p className="text-gray-500">
                                { submission.evaluation ? "Scores for this challenge have not been published yet." : "Your submission has not been evaluated yet."}
                            </p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export const SubChallengeDetail: React.FC<SubChallengeDetailProps> = ({ currentUser }) => {
    const { batchId, subChallengeId } = useParams<{ batchId: string, subChallengeId: string }>();
    const [subChallenge, setSubChallenge] = useState<SubChallengeWithSubmissions | null>(null);
    const [overallChallenge, setOverallChallenge] = useState<OverallChallenge | null>(null);
    const [evaluators, setEvaluators] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [linkCopied, setLinkCopied] = useState(false);

    // State for publishing action
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

    const fetchDetails = async () => {
        if (!subChallengeId) return;
        setLoading(true);
        const { data: scData, error: scError } = await supabase
            .from('sub_challenges')
            .select('*, submissions(*, profiles(id, name, avatar_url, email, role))')
            .eq('id', subChallengeId!)
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

    useEffect(() => {
        fetchDetails();
    }, [subChallengeId]);

    const handlePublishScores = async () => {
        if (!subChallengeId) return;
        const isConfirmed = window.confirm("Are you sure you want to publish all scores? This action will make the leaderboard and results visible to all participants.");
        if (isConfirmed) {
            setIsPublishing(true);
            setPublishError(null);
            setPublishSuccess(null);

            const { error } = await supabase
                .from('sub_challenges')
                .update({ scores_published_at: new Date().toISOString() })
                .eq('id', subChallengeId);
            
            if (error) {
                setPublishError(`Failed to publish scores: ${error.message}`);
            } else {
                setPublishSuccess("Scores published successfully!");
                // Refetch just the subchallenge to update its status
                const { data: scData } = await supabase
                    .from('sub_challenges')
                    .select('*, submissions(*, profiles(id, name, avatar_url, email, role))')
                    .eq('id', subChallengeId!)
                    .single<SubChallengeWithSubmissions>();
                if (scData) {
                    setSubChallenge(scData);
                }
                setTimeout(() => setPublishSuccess(null), 3000);
            }
            setIsPublishing(false);
        }
    };

    const handleCopyPublicLink = () => {
        const link = `${window.location.origin}/#/sub-challenge-leaderboard/${subChallengeId}`;
        navigator.clipboard.writeText(link).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy link.');
        });
    };

    if (loading) return <div className="p-8">Loading details...</div>;
    if (!subChallenge || !overallChallenge) {
        return <div className="text-center p-8">Challenge not found.</div>;
    }

    const backLink = currentUser.role === Role.MANAGER 
        ? `/batch/${batchId}/level/4/challenge/${overallChallenge.id}` 
        : `/batch/${batchId}/level/4/trainee`;

    const backLinkText = currentUser.role === Role.MANAGER ? 'Back to Challenge Details' : 'Back to Dashboard';

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to={backLink} text={backLinkText} />
            
            <Card className="mb-8">
                <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">{subChallenge.title}</h1>
                        <p className="text-gray-500 dark:text-gray-400">Part of "{overallChallenge.name}"</p>
                    </div>
                    {currentUser.role === Role.MANAGER && (
                         <div className="flex items-center space-x-2">
                             <Button onClick={handleCopyPublicLink} variant="secondary">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>
                                {linkCopied ? 'Copied!' : 'Copy Public Link'}
                             </Button>
                         </div>
                    )}
                </div>
                <div className="mt-4 border-t dark:border-gray-700 pt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
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
                     <div className="md:col-span-2">
                        <p className="font-semibold">Summary</p>
                        <div
                            className="prose dark:prose-invert max-w-none mt-1"
                            dangerouslySetInnerHTML={{ __html: subChallenge.summary || '' }}
                        />
                    </div>
                     <div className="md:col-span-2">
                        <p className="font-semibold">Claim Focus</p>
                        <p className="whitespace-pre-wrap mt-1">{subChallenge.claim_focus}</p>
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
            
            {publishError && (
                <div className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm" role="alert">
                    {publishError}
                </div>
            )}
            {publishSuccess && (
                <div className="mb-4 p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm" role="alert">
                    {publishSuccess}
                </div>
            )}

            {currentUser.role === Role.MANAGER && <ManagerView subChallenge={subChallenge} onPublish={handlePublishScores} isPublishing={isPublishing} />}
            {currentUser.role === Role.TRAINEE && batchId && <TraineeView batchId={batchId} subChallenge={subChallenge} overallChallenge={overallChallenge} currentUser={currentUser} />}
            <style>{`
            .prose mark {
                background-color: #fef08a;
                padding: 0.1em;
            }
            `}</style>
        </div>
    );
};