import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { Profile, ResultEvaluation, SubmittedResult, SubChallenge, Submission, Evaluation, EvaluationRules, SubmissionWithProfile, SubChallengeWithSubmissions, Json, EvaluationResultTier, OverallChallenge } from '../../types';

const DuplicateCheckView: React.FC<{ submissions: SubmissionWithProfile[] }> = ({ submissions }) => {
    const duplicateResults = useMemo(() => {
        const resultsMap = new Map<string, { profile: Profile | null; submittedAt: string }[]>();

        submissions.forEach(sub => {
            const results = (sub.results as unknown as SubmittedResult[]) || [];
            results.forEach(result => {
                const normalizedValue = result.value.trim().toLowerCase();
                if (!resultsMap.has(normalizedValue)) {
                    resultsMap.set(normalizedValue, []);
                }
                resultsMap.get(normalizedValue)!.push({
                    profile: sub.profiles,
                    submittedAt: result.submitted_at || sub.submitted_at // Fallback to overall submission time
                });
            });
        });

        const duplicates = Array.from(resultsMap.entries())
            .filter(([_, trainees]) => trainees.length > 1)
            .map(([value, trainees]) => ({ value, trainees }));
        
        return duplicates;
    }, [submissions]);

    if (duplicateResults.length === 0) {
        return (
            <Card>
                <p className="text-center text-gray-500">No duplicate results found among submissions.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Duplicate Results Found</h2>
            {duplicateResults.map(({ value, trainees }) => (
                <Card key={value}>
                    <h3 className="text-lg font-semibold font-mono break-all">{value}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Submitted by {trainees.length} trainees:</p>
                    <ul className="space-y-3">
                        {trainees
                            .sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime()) // Sort by submission time
                            .map(({ profile, submittedAt }, index) => (
                            <li key={profile?.id || index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <span className="font-medium text-sm">{profile?.name || 'Unknown Trainee'}</span>
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                    {submittedAt ? new Date(submittedAt).toLocaleString() : 'N/A'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Card>
            ))}
        </div>
    );
};


interface EvaluateSubmissionProps {
    currentUser: Profile;
}

type SubChallengeForEvaluation = SubChallengeWithSubmissions & {
    overall_challenges: Pick<OverallChallenge, 'ended_at'> | null;
};

export const EvaluateSubmission: React.FC<EvaluateSubmissionProps> = ({ currentUser }) => {
    const { challengeId } = useParams<{ challengeId: string }>();
    const navigate = useNavigate();
    const [challenge, setChallenge] = useState<SubChallengeForEvaluation | null>(null);
    const [loading, setLoading] = useState(true);

    const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'evaluate' | 'duplicates'>('evaluate');
    
    // Derived state for the selected submission
    const selectedSubmission = useMemo(() => {
        return challenge?.submissions?.find(s => s.trainee_id === selectedTraineeId);
    }, [challenge, selectedTraineeId]);
    
    // Form state
    const [resultEvals, setResultEvals] = useState<ResultEvaluation[]>([]);
    const [reportScore, setReportScore] = useState<number | string>('');
    const [feedback, setFeedback] = useState<string>('');
    const [reportUrl, setReportUrl] = useState<string | null>(null);

    // State to track saved data for change detection
    const [savedEvaluation, setSavedEvaluation] = useState<Evaluation | null>(null);
    const [savedInSession, setSavedInSession] = useState<{ [key: string]: boolean }>({}); // keys: result_id, 'report'
    
    // Loading/submitting states
    const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({}); // keys: result_id, 'report', 'final'
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);


    const fetchChallenge = useCallback(async () => {
        if (!challengeId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('sub_challenges')
            .select('*, submissions(*, profiles(id, name, avatar_url, email, role)), overall_challenges(ended_at)')
            .eq('id', challengeId)
            .single<SubChallengeForEvaluation>();
        
        if (error) {
            console.error(error);
            setError(error.message);
        } else if (data) {
            setChallenge(data);
            if (data.submissions && data.submissions.length > 0 && !selectedTraineeId) {
                // Default to the first unevaluated submission, or just the first one.
                const firstUnevaluated = data.submissions.find(s => !s.evaluation);
                setSelectedTraineeId(firstUnevaluated?.trainee_id || data.submissions[0].trainee_id);
            }
        }
        setLoading(false);
    }, [challengeId, selectedTraineeId]);

    useEffect(() => {
        fetchChallenge();
    }, [fetchChallenge]);
    
    // Effect to reset form when selected trainee changes
    useEffect(() => {
        if (!selectedSubmission) {
            // Clear form if no submission is selected
            setResultEvals([]);
            setReportScore('');
            setFeedback('');
            setSavedEvaluation(null);
            setReportUrl(null);
            setSavedInSession({});
            return;
        };

        const submittedResults = (selectedSubmission.results as unknown as SubmittedResult[]) || [];
        const existingEval = selectedSubmission.evaluation as unknown as Evaluation | null;

        // Create a full list of evaluations, ensuring one for each submitted result.
        const initialEvals = submittedResults.map(result => {
            const existing = existingEval?.result_evaluations.find(re => re.result_id === result.id);
            return existing || { result_id: result.id, evaluator_tier: EvaluationResultTier.TIER_3 }; // Default to TIER_3
        });
        
        setResultEvals(initialEvals);
        setReportScore(existingEval?.report_score ?? '');
        setFeedback(existingEval?.feedback ?? '');

        // Set the baseline for change detection
        const baselineEval: Evaluation = {
            evaluator_id: currentUser.id,
            result_evaluations: initialEvals,
            report_score: existingEval?.report_score,
            feedback: existingEval?.feedback ?? '',
            evaluated_at: new Date().toISOString(),
        };
        setSavedEvaluation(baselineEval);
        
        // Reset session save status
        setSavedInSession({});

        // Fetch report URL
        const fetchUrl = async () => {
            if (selectedSubmission.report_file) {
                const reportPath = (selectedSubmission.report_file as { path: string }).path;
                const { data, error } = await supabase.storage.from('reports').createSignedUrl(reportPath, 300); // 5 mins
                if (error) console.error("Error creating signed URL:", error);
                else setReportUrl(data.signedUrl);
            } else {
                setReportUrl(null);
            }
        };
        fetchUrl();

    }, [selectedSubmission, currentUser.id]);

    const isResultDirty = useCallback((resultId: string) => {
        if (!savedEvaluation) return true;
        const current = resultEvals.find(re => re.result_id === resultId);
        const saved = savedEvaluation.result_evaluations.find(re => re.result_id === resultId);
        return current?.evaluator_tier !== saved?.evaluator_tier;
    }, [resultEvals, savedEvaluation]);

    const isReportDirty = useCallback(() => {
        if (!savedEvaluation) return true;
        const currentReportScore = reportScore === '' ? undefined : Number(reportScore);
        return currentReportScore !== savedEvaluation.report_score || feedback !== savedEvaluation.feedback;
    }, [reportScore, feedback, savedEvaluation]);

    const handleSave = async (updatedFields: Partial<Evaluation>) => {
        if (!selectedSubmission) return false;
        
        setError(null);
        setSuccess(null);

        const newEvaluation: Evaluation = {
            evaluator_id: currentUser.id,
            result_evaluations: resultEvals,
            report_score: reportScore === '' ? undefined : Number(reportScore),
            feedback: feedback,
            ...updatedFields,
            evaluated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
            .from('submissions')
            .update({ evaluation: newEvaluation as unknown as Json })
            .eq('id', selectedSubmission.id);

        if (updateError) {
            setError(`Failed to save: ${updateError.message}`);
            return false;
        } else {
            setSavedEvaluation(newEvaluation); // Update baseline
            return true;
        }
    };
    
    const handleSaveResult = async (resultId: string) => {
        if (savedInSession[resultId]) {
            if (!window.confirm("Are you sure you want to change this saved evaluation?")) {
                return;
            }
        }
        setIsSaving(prev => ({ ...prev, [resultId]: true }));
        const success = await handleSave({});
        if (success) {
            setSuccess(`Result evaluation saved.`);
            setSavedInSession(prev => ({...prev, [resultId]: true}));
            setTimeout(() => setSuccess(null), 3000);
        }
        setIsSaving(prev => ({ ...prev, [resultId]: false }));
    };

    const handleSaveReport = async () => {
        if (savedInSession['report']) {
            if (!window.confirm("Are you sure you want to change the saved report evaluation?")) {
                return;
            }
        }
        setIsSaving(prev => ({ ...prev, report: true }));
        const success = await handleSave({});
        if (success) {
            setSuccess('Report & Feedback saved.');
            setSavedInSession(prev => ({...prev, report: true}));
            setTimeout(() => setSuccess(null), 3000);
        }
        setIsSaving(prev => ({ ...prev, report: false }));
    };

    const handleSubmitAllAndNext = async () => {
        setIsSaving(prev => ({ ...prev, final: true }));
        const success = await handleSave({});
        if (success) {
            // Find next trainee
            const currentIndex = challenge?.submissions.findIndex(s => s.trainee_id === selectedTraineeId) ?? -1;
            const nextIndex = (currentIndex + 1) % (challenge?.submissions.length ?? 1);
            if (challenge?.submissions[nextIndex]) {
                setSelectedTraineeId(challenge.submissions[nextIndex].trainee_id);
            }
            await fetchChallenge(); // Re-fetch to update progress bar on dashboard
        }
        setIsSaving(prev => ({ ...prev, final: false }));
    };

    if (loading) return <div className="p-8">Loading evaluation...</div>;
    if (!challenge) return <div className="p-8 text-center">Challenge not found.</div>;
    if (challenge.submissions.length === 0) {
        return (
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <BackButton to="/evaluator" text="Back to Dashboard" />
                <Card className="text-center py-10">
                    <p className="text-gray-500">There are no submissions for this challenge yet.</p>
                </Card>
            </div>
        );
    }
    
    // FIX: Cast to unknown first to safely convert from Json type to SubmittedResult[]
    const submittedResults = (selectedSubmission?.results as unknown as SubmittedResult[]) || [];
    const rules = challenge.evaluation_rules as unknown as EvaluationRules;
    const isChallengeEnded = !!challenge.overall_challenges?.ended_at;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to="/evaluator" text="Back to Dashboard" />
            <h1 className="text-3xl font-bold mb-2">{challenge.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Evaluation Form</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                    <h2 className="text-xl font-semibold mb-4">Trainees</h2>
                    <Card>
                        <ul className="space-y-1">
                            {challenge.submissions.map(sub => (
                                <li key={sub.trainee_id}>
                                    <button
                                        onClick={() => setSelectedTraineeId(sub.trainee_id)}
                                        className={`w-full text-left p-3 rounded-lg flex items-center justify-between ${selectedTraineeId === sub.trainee_id ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    >
                                        <span className="font-medium">{sub.profiles?.name}</span>
                                        {sub.evaluation && <span className="text-green-500 text-xs font-bold">✓ Evaluated</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>

                <div className="lg:col-span-3">
                    <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            <button onClick={() => setActiveTab('evaluate')} className={`${activeTab === 'evaluate' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Evaluate Submission
                            </button>
                            <button onClick={() => setActiveTab('duplicates')} className={`${activeTab === 'duplicates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Duplicate Check
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'evaluate' && (
                        <>
                            {selectedSubmission ? (
                                <Card>
                                    <div className="pb-4 mb-6 border-b dark:border-gray-700">
                                        <h2 className="text-2xl font-semibold">Evaluating: {selectedSubmission.profiles?.name}</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Submitted at: {new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
                                    </div>

                                    {isChallengeEnded && (
                                        <div className="mb-4 p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm" role="status">
                                            This challenge has ended. Evaluations are now read-only and cannot be modified.
                                        </div>
                                    )}
                                    
                                    {error && <div className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm" role="alert">{error}</div>}
                                    {success && <div className="mb-4 p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm" role="alert">{success}</div>}

                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2">Submitted Results</h3>
                                            {submittedResults.map((result) => {
                                                const currentEvalValue = resultEvals.find(re => re.result_id === result.id)?.evaluator_tier;
                                                return (
                                                <div key={result.id} className="p-3 mb-2 bg-gray-50 dark:bg-gray-800 rounded-lg flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                                                    <div className="flex-grow mb-3 sm:mb-0">
                                                        <p className="font-mono text-sm">{result.value}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {result.type} - Submitted as {result.trainee_tier}
                                                            {result.submitted_at && (
                                                                <span className="ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                                                                    Submitted: {new Date(result.submitted_at).toLocaleString()}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={currentEvalValue || ''}
                                                            onChange={(e) => {
                                                                const newTier = e.target.value as EvaluationResultTier;
                                                                setResultEvals(prev => prev.map(re => re.result_id === result.id ? { ...re, evaluator_tier: newTier } : re));
                                                            }}
                                                            className="input w-40"
                                                            disabled={isChallengeEnded}
                                                        >
                                                            {Object.values(EvaluationResultTier).map(tier => <option key={tier} value={tier}>{tier}</option>)}
                                                        </select>
                                                        <Button 
                                                            onClick={() => handleSaveResult(result.id)} 
                                                            disabled={!isResultDirty(result.id) || isSaving[result.id] || isChallengeEnded}
                                                            className="w-28"
                                                        >
                                                            {isSaving[result.id] ? 'Saving...' : savedInSession[result.id] ? '✓ Saved' : 'Save'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )})}
                                        </div>
                                        {rules.report.enabled && (
                                            <div className="pt-6 border-t dark:border-gray-700">
                                                <h3 className="text-lg font-semibold mb-2">Report & Feedback</h3>
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-4">
                                                    <div className="flex-grow">
                                                        <label htmlFor="reportScore">Report Score (Max: {rules.report.maxScore})</label>
                                                        <input id="reportScore" type="number" max={rules.report.maxScore} min="0" value={reportScore} onChange={e => setReportScore(e.target.value)} className="input" disabled={isChallengeEnded} />
                                                        {reportUrl && (
                                                            <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 block">
                                                                View Submitted Report
                                                            </a>
                                                        )}
                                                    </div>
                                                    <div className="flex-grow-[2] mt-4 sm:mt-0">
                                                        <label htmlFor="feedback">Overall Feedback</label>
                                                        <textarea id="feedback" value={feedback} onChange={e => setFeedback(e.target.value)} rows={4} className="input" disabled={isChallengeEnded} />
                                                    </div>
                                                    <div className="self-end mt-4 sm:mt-0">
                                                        <Button 
                                                            onClick={handleSaveReport}
                                                            disabled={!isReportDirty() || isSaving['report'] || isChallengeEnded}
                                                            className="w-full sm:w-auto"
                                                        >
                                                            {isSaving['report'] ? 'Saving...' : savedInSession['report'] ? '✓ Saved' : 'Save Report & Feedback'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-6 mt-6 border-t dark:border-gray-700 flex justify-end">
                                        <Button onClick={handleSubmitAllAndNext} disabled={isSaving['final'] || isChallengeEnded}>
                                            {isSaving['final'] ? 'Submitting...' : 'Submit Complete Evaluation & Next'}
                                        </Button>
                                    </div>
                                </Card>
                            ) : (
                                <Card className="flex items-center justify-center h-96">
                                    <p className="text-gray-500">Select a trainee from the list to begin evaluation.</p>
                                </Card>
                            )}
                        </>
                    )}
                    
                    {activeTab === 'duplicates' && challenge && (
                        <DuplicateCheckView submissions={challenge.submissions} />
                    )}
                </div>
            </div>
            <style>{`.input { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; padding: 0.5rem 0.75rem; } .dark .input { background-color: #374151; border-color: #4B5563; }`}</style>
        </div>
    );
};
