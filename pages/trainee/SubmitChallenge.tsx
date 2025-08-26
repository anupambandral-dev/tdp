import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { SubmittedResult, ResultType, ResultTier, Profile, Submission, SubChallenge, OverallChallenge, Json, EvaluationRules } from '../../types';
import { TablesInsert, TablesUpdate } from '../../database.types';

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gray-500 hover:text-red-500"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h-4"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

interface SubmitChallengeProps {
    currentUser: Profile;
}

export const SubmitChallenge: React.FC<SubmitChallengeProps> = ({ currentUser }) => {
    const { challengeId: subChallengeId } = useParams<{ challengeId: string }>();
    const navigate = useNavigate();

    const [subChallenge, setSubChallenge] = useState<SubChallenge | null>(null);
    const [overallChallenge, setOverallChallenge] = useState<OverallChallenge | null>(null);
    const [existingSubmission, setExistingSubmission] = useState<Submission | null>(null);

    const [results, setResults] = useState<SubmittedResult[]>([]);
    const [newResultValue, setNewResultValue] = useState('');
    const [newResultType, setNewResultType] = useState<ResultType>(ResultType.PATENT);
    const [newResultTier, setNewResultTier] = useState<ResultTier>(ResultTier.TIER_1);
    
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [existingReportName, setExistingReportName] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState({ results: '', report: '' });
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const calculateTimeLeft = useCallback(() => {
        if (!subChallenge) return { results: '', report: '' };
        
        const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;

        const calculate = (endTime: string | null) => {
            if (!endTime) return 'Not set';
            const difference = +new Date(endTime) - +new Date();
            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                const seconds = Math.floor((difference / 1000) % 60);
                return `${days}d ${hours}h ${minutes}m ${seconds}s remaining`;
            }
            return 'Deadline has passed';
        };
        
        const resultsTimeLeft = calculate(subChallenge.submission_end_time);
        const reportTimeLeft = rules.report.enabled ? calculate(subChallenge.report_end_time) : 'Not applicable';

        return { results: resultsTimeLeft, report: reportTimeLeft };
    }, [subChallenge]);


    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);
        return () => clearInterval(timer);
    }, [calculateTimeLeft]);

    const fetchSubmission = useCallback(async () => {
        if (!subChallengeId || !currentUser.id) return;
        const { data: submissionData, error: submissionError } = await supabase
            .from('submissions')
            .select('*')
            .eq('sub_challenge_id', subChallengeId)
            .eq('trainee_id', currentUser.id)
            .single();

        if (submissionData) {
            setExistingSubmission(submissionData);
            setResults((submissionData.results as unknown as SubmittedResult[]) || []);
            const report = submissionData.report_file as { name: string; path: string } | null;
            if (report) {
                setExistingReportName(report.name);
            } else {
                setExistingReportName(null);
            }
        } else {
            setExistingSubmission(null);
            setResults([]);
            setExistingReportName(null);
        }
        if (submissionError && submissionError.code !== 'PGRST116') { // Ignore 'single row not found' error
            console.error("Error fetching existing submission:", submissionError);
            setErrorMessage("Could not fetch latest submission data.");
        }
    }, [subChallengeId, currentUser.id]);


    useEffect(() => {
        const fetchData = async () => {
            if (!subChallengeId) return;
            setLoading(true);

            const { data: scData, error: scError } = await supabase
                .from('sub_challenges')
                .select('*')
                .eq('id', subChallengeId)
                .single();

            if (scError) {
                console.error("Error fetching sub-challenge:", scError);
                setLoading(false);
                return;
            }
            setSubChallenge(scData);

            const { data: ocData, error: ocError } = await supabase
                .from('overall_challenges')
                .select('*')
                .eq('id', scData.overall_challenge_id)
                .single();

            if (ocError) {
                console.error("Error fetching overall challenge:", ocError);
            } else {
                setOverallChallenge(ocData);
            }

            await fetchSubmission();
            setLoading(false);
        };
        fetchData();
    }, [subChallengeId, currentUser.id, fetchSubmission]);
    
    const handleAddResult = () => {
        if (!newResultValue.trim()) return;
        const newResult: SubmittedResult = {
            id: uuidv4(),
            value: newResultValue.trim(),
            type: newResultType,
            trainee_tier: newResultTier,
        };
        setResults([...results, newResult]);
        setNewResultValue('');
    };

    const handleRemoveResult = (id: string) => {
        setResults(results.filter(r => r.id !== id));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setReportFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        let reportFileData: { path: string; name: string } | null = existingSubmission?.report_file as any;

        if (reportFile) {
            if (!currentUser.auth_id) {
                setErrorMessage("Authentication error: User ID could not be found. Please try logging out and in again.");
                setSubmitting(false);
                return;
            }

            if (existingSubmission?.report_file) {
                 const oldPath = (existingSubmission.report_file as {path: string}).path;
                 const { error: removeError } = await supabase.storage.from('reports').remove([oldPath]);
                 if (removeError) {
                    console.warn(`Could not remove the old report file at path: ${oldPath}. It may be orphaned. Error: ${removeError.message}`);
                 }
            }

            const filePath = `${currentUser.auth_id}/${subChallengeId}/${uuidv4()}-${reportFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('reports')
                .upload(filePath, reportFile);

            if (uploadError) {
                setErrorMessage(`Error uploading report: ${uploadError.message}`);
                setSubmitting(false);
                return;
            }
            reportFileData = { path: filePath, name: reportFile.name };
        }

        const submissionData: TablesInsert<'submissions'> & TablesUpdate<'submissions'> = {
            id: existingSubmission?.id ?? undefined,
            sub_challenge_id: subChallengeId!,
            trainee_id: currentUser.id,
            results: results as unknown as Json,
            report_file: reportFileData as unknown as Json,
            submitted_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
            .from('submissions')
            .upsert(submissionData, { onConflict: 'trainee_id, sub_challenge_id' });

        if (upsertError) {
            setErrorMessage(`Error saving submission: ${upsertError.message}`);
        } else {
            setSuccessMessage('Submission saved successfully!');
            setReportFile(null); // Clear the file input state
            await fetchSubmission(); // Refresh component state with latest data
            setTimeout(() => setSuccessMessage(null), 5000);
        }
        setSubmitting(false);
    };

    if (loading) return <div className="p-8">Loading submission form...</div>;
    if (!subChallenge || !overallChallenge) return <div className="p-8 text-center">Challenge not found.</div>;
    
    const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;
    const isChallengeEnded = !!overallChallenge.ended_at;

    const isResultsDeadlinePassed = new Date(subChallenge.submission_end_time) < new Date();
    const isResultsDisabled = isResultsDeadlinePassed || isChallengeEnded || submitting;

    const isReportDeadlinePassed = !rules.report.enabled || !subChallenge.report_end_time || new Date(subChallenge.report_end_time) < new Date();
    const isReportDisabled = isReportDeadlinePassed || isChallengeEnded || submitting;
    
    const isSubmitButtonDisabled = (isResultsDisabled && isReportDisabled) || submitting;
    
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <BackButton to={`/trainee/sub-challenge/${subChallenge.id}`} text="Back to Challenge Details" />
            <Card>
                <div className="border-b pb-4 mb-6 dark:border-gray-700">
                    <h1 className="text-3xl font-bold">{subChallenge.title}</h1>
                    <p className="text-gray-500 dark:text-gray-400">Submission Form</p>
                    <div className="mt-2 space-y-1 text-sm">
                        <p>
                            Results Deadline: 
                            <span className={`font-semibold ml-2 ${timeLeft.results.includes('passed') ? 'text-red-500' : 'text-green-600'}`}>
                                {timeLeft.results}
                            </span>
                        </p>
                        {rules.report.enabled && (
                            <p>
                                Report Deadline: 
                                <span className={`font-semibold ml-2 ${timeLeft.report.includes('passed') ? 'text-red-500' : 'text-green-600'}`}>
                                    {timeLeft.report}
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                {successMessage && (
                    <div className="mb-4 p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm" role="alert">
                        {successMessage}
                    </div>
                )}
                {errorMessage && (
                    <div className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm" role="alert">
                        {errorMessage}
                    </div>
                )}


                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Add/Edit Results Section */}
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Prior Art Results</h2>
                        <div className="space-y-4 mb-6">
                            {results.map(result => (
                                <div key={result.id} className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="flex-grow">
                                        <p className="font-mono text-sm">{result.value}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{result.type} - {result.trainee_tier}</p>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveResult(result.id)} disabled={isResultsDisabled} aria-label={`Remove result ${result.value}`}>
                                        <TrashIcon />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className={`p-4 border-t dark:border-gray-700 ${isResultsDisabled ? 'opacity-50' : ''}`}>
                             <h3 className="font-medium mb-4">Add New Result</h3>
                             <div className="space-y-4">
                                <div>
                                    <label htmlFor="newResultValue">Result (e.g., Patent Number, URL)</label>
                                    <input id="newResultValue" type="text" value={newResultValue} onChange={e => setNewResultValue(e.target.value)} placeholder="US-1234567-B2" className="input" disabled={isResultsDisabled} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="newResultType">Result Type</label>
                                        <select id="newResultType" value={newResultType} onChange={e => setNewResultType(e.target.value as ResultType)} className="input" disabled={isResultsDisabled}>
                                            {Object.values(ResultType).map(type => <option key={type} value={type}>{type}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="newResultTier">Tier Category</label>
                                        <select id="newResultTier" value={newResultTier} onChange={e => setNewResultTier(e.target.value as ResultTier)} className="input" disabled={isResultsDisabled}>
                                            {Object.values(ResultTier).map(tier => <option key={tier} value={tier}>{tier}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Button type="button" variant="secondary" onClick={handleAddResult} disabled={isResultsDisabled || !newResultValue.trim()}>
                                        + Add Result
                                    </Button>
                                </div>
                             </div>
                        </div>
                    </div>

                    {/* Report Upload Section */}
                    {rules.report.enabled && (
                        <div>
                            <h2 className="text-xl font-semibold mb-4">Search Report</h2>
                            <div className={`p-4 border rounded-lg dark:border-gray-700 ${isReportDisabled ? 'opacity-50' : ''}`}>
                                {existingReportName && !reportFile && (
                                    <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                                        Current file: <span className="font-semibold">{existingReportName}</span>
                                    </p>
                                )}
                                <label htmlFor="reportFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {existingReportName ? 'Upload a new file to replace the old one' : 'Upload your report'}
                                </label>
                                <input 
                                    id="reportFile" 
                                    type="file" 
                                    onChange={handleFileChange} 
                                    className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300 dark:hover:file:bg-blue-800/30"
                                    disabled={isReportDisabled}
                                />
                                {reportFile && (
                                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                                        New file selected: <span className="font-semibold">{reportFile.name}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Final Submit Button */}
                    <div className="pt-6 border-t dark:border-gray-700 flex justify-end">
                        <Button type="submit" disabled={isSubmitButtonDisabled}>
                            {submitting ? 'Submitting...' : (existingSubmission ? 'Update Submission' : 'Submit')}
                        </Button>
                    </div>
                </form>
            </Card>
            <style>{`label { display: block; margin-bottom: 0.25rem; font-weight: 500; } .input { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; padding: 0.5rem 0.75rem; } .dark .input { background-color: #374151; border-color: #4B5563; }`}</style>
        </div>
    );
};
