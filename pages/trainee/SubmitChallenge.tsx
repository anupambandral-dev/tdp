import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { SubmittedResult, ResultType, ResultTier, Profile, Submission, SubChallenge, OverallChallenge, Json, EvaluationRules } from '../../types';

interface SubmitChallengeProps {
    currentUser: Profile;
}

export const SubmitChallenge: React.FC<SubmitChallengeProps> = ({ currentUser }) => {
    const { batchId, challengeId: subChallengeId } = useParams<{ batchId: string; challengeId: string }>();
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
    const [activeTab, setActiveTab] = useState<'results' | 'report'>('results');

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

        if (submissionError && submissionError.code !== 'PGRST116') { // Ignore 'single row not found' error
            console.error("Error fetching existing submission:", submissionError);
            setErrorMessage("Could not fetch latest submission data.");
            return;
        }

        if (submissionData) {
            setExistingSubmission(submissionData as Submission);
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
                setErrorMessage("Could not load challenge details.");
                setLoading(false);
                return;
            }
            setSubChallenge(scData as SubChallenge);

            const { data: ocData, error: ocError } = await supabase
                .from('overall_challenges')
                .select('*')
                .eq('id', scData.overall_challenge_id)
                .single();

            if (ocError) {
                console.error("Error fetching overall challenge:", ocError);
            } else {
                setOverallChallenge(ocData as OverallChallenge);
            }

            await fetchSubmission();
            setLoading(false);
        };
        fetchData();
    }, [subChallengeId, currentUser.id, fetchSubmission]);
    
    const handleResultSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newResultValue.trim()) {
            setErrorMessage("Result value cannot be empty.");
            return;
        }

        setSubmitting(true);
        setErrorMessage(null);

        const { data: latestSubmission, error: fetchError } = await supabase
            .from('submissions')
            .select('id, results')
            .eq('sub_challenge_id', subChallengeId!)
            .eq('trainee_id', currentUser.id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            setErrorMessage(`Could not verify submission status: ${fetchError.message}`);
            setSubmitting(false);
            return;
        }

        const newResult: SubmittedResult = {
            id: uuidv4(),
            value: newResultValue.trim(),
            type: newResultType,
            trainee_tier: newResultTier,
            submitted_at: new Date().toISOString(),
        };

        let dbError = null;

        if (latestSubmission) { // Submission exists, so UPDATE it
            const currentResults = (latestSubmission.results as unknown as SubmittedResult[] | null) || [];

            if (subChallenge?.submission_limit !== null && currentResults.length >= subChallenge.submission_limit) {
                setErrorMessage(`You cannot submit more than ${subChallenge.submission_limit} results.`);
                setSubmitting(false);
                return;
            }

            const newResultsArray = [...currentResults, newResult];
            const { error: updateError } = await supabase
                .from('submissions')
                .update({ results: newResultsArray as unknown as Json, submitted_at: new Date().toISOString() })
                .eq('id', latestSubmission.id);
            dbError = updateError;

        } else { // No submission exists, so INSERT a new one
            const newResultsArray = [newResult];
            const { error: insertError } = await supabase
                .from('submissions')
                .insert([{
                    sub_challenge_id: subChallengeId!,
                    trainee_id: currentUser.id,
                    results: newResultsArray as unknown as Json,
                }]);
            dbError = insertError;
        }
        
        if (dbError) {
            setErrorMessage(`Error saving result: ${dbError.message}`);
        } else {
            setSuccessMessage('Result submitted successfully!');
            setNewResultValue('');
            await fetchSubmission();
            setTimeout(() => setSuccessMessage(null), 3000);
        }
        setSubmitting(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setReportFile(e.target.files[0]);
        }
    };
    
    const handleReportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reportFile) {
            setErrorMessage("Please select a file to upload.");
            return;
        }

        setSubmitting(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        const fileExt = reportFile.name.split('.').pop();
        const fileName = `${currentUser.id}_${uuidv4()}.${fileExt}`;
        const filePath = `${subChallengeId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('reports')
            .upload(filePath, reportFile, {
                cacheControl: '3600',
                upsert: true,
            });

        if (uploadError) {
            setErrorMessage(`Failed to upload report: ${uploadError.message}`);
            setSubmitting(false);
            return;
        }

        const reportFileData = {
            path: filePath,
            name: reportFile.name,
        };
        
        const { error: dbError } = await supabase
            .from('submissions')
            .upsert(
                {
                    id: existingSubmission?.id,
                    sub_challenge_id: subChallengeId!,
                    trainee_id: currentUser.id,
                    report_file: reportFileData as unknown as Json,
                    submitted_at: new Date().toISOString(),
                },
                { onConflict: 'sub_challenge_id, trainee_id' }
            );

        if (dbError) {
            setErrorMessage(`Failed to save report record: ${dbError.message}`);
        } else {
            setSuccessMessage('Report submitted successfully!');
            await fetchSubmission();
            setReportFile(null);
            const fileInput = document.getElementById('reportFile') as HTMLInputElement;
            if (fileInput) fileInput.value = "";
            setTimeout(() => setSuccessMessage(null), 3000);
        }
        setSubmitting(false);
    };

    const handleDeleteResult = async (resultId: string) => {
        if (!existingSubmission) return;

        const isConfirmed = window.confirm("Are you sure you want to delete this result?");
        if (!isConfirmed) return;

        const updatedResults = results.filter(r => r.id !== resultId);

        const { error } = await supabase
            .from('submissions')
            .update({ results: updatedResults as unknown as Json })
            .eq('id', existingSubmission.id);
        
        if (error) {
            setErrorMessage(`Failed to delete result: ${error.message}`);
        } else {
            setSuccessMessage("Result deleted.");
            await fetchSubmission();
            setTimeout(() => setSuccessMessage(null), 3000);
        }
    };

    if (loading) return <div className="p-8">Loading submission page...</div>;
    if (!subChallenge) return <div className="p-8 text-center">Challenge not found or you do not have access.</div>;
    
    const isOverallChallengeEnded = !!overallChallenge?.ended_at;
    const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;
    
    const isResultsSubmissionOpen = new Date(subChallenge.submission_end_time) > new Date();
    const isReportSubmissionOpen = rules.report.enabled && subChallenge.report_end_time ? new Date(subChallenge.report_end_time) > new Date() : false;

    const canSubmitResults = !isOverallChallengeEnded && isResultsSubmissionOpen;
    const canSubmitReport = !isOverallChallengeEnded && isReportSubmissionOpen;
    
    const canSubmitMoreResults = !subChallenge.submission_limit || results.length < subChallenge.submission_limit;

    const inputClasses = "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2";
    const labelClasses = "block mb-1 text-sm font-medium";

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <BackButton to={`/batch/${batchId}/level/4/trainee/sub-challenge/${subChallengeId}`} text="Back to Challenge Details" />

            <Card className="mb-6">
                <h1 className="text-3xl font-bold">{subChallenge.title}</h1>
                <p className="text-gray-500 dark:text-gray-400">Patent: {subChallenge.patent_number}</p>
            </Card>

            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('results')} className={`${activeTab === 'results' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Submit Results
                    </button>
                    {rules.report.enabled && (
                        <button onClick={() => setActiveTab('report')} className={`${activeTab === 'report' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                            Submit Report
                        </button>
                    )}
                </nav>
            </div>
            
            {errorMessage && <div className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm" role="alert">{errorMessage}</div>}
            {successMessage && <div className="mb-4 p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm" role="alert">{successMessage}</div>}

            {activeTab === 'results' && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold">Results Submission</h2>
                        <div className="text-right">
                             <p className={`text-sm font-semibold ${canSubmitResults ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {canSubmitResults ? 'Open' : 'Closed'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{timeLeft.results}</p>
                        </div>
                    </div>
                    {canSubmitResults && canSubmitMoreResults && (
                        <form onSubmit={handleResultSubmit} className="space-y-4 p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <div>
                                <label htmlFor="resultValue" className={labelClasses}>Result Value (e.g., US-1234567-B2)</label>
                                <input id="resultValue" type="text" value={newResultValue} onChange={e => setNewResultValue(e.target.value)} required className={inputClasses} disabled={submitting} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="resultType" className={labelClasses}>Type</label>
                                    <select id="resultType" value={newResultType} onChange={e => setNewResultType(e.target.value as ResultType)} className={inputClasses} disabled={submitting}>
                                        {Object.values(ResultType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="resultTier" className={labelClasses}>Tier</label>
                                    <select id="resultTier" value={newResultTier} onChange={e => setNewResultTier(e.target.value as ResultTier)} className={inputClasses} disabled={submitting}>
                                        {Object.values(ResultTier).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="text-right">
                                <Button type="submit" disabled={submitting || !canSubmitResults}>
                                    {submitting ? 'Submitting...' : 'Add Result'}
                                </Button>
                            </div>
                        </form>
                    )}
                    {!canSubmitMoreResults && canSubmitResults && (
                         <div className="p-3 text-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-md">
                            You have reached the submission limit of {subChallenge.submission_limit} results.
                        </div>
                    )}
                     {!canSubmitResults && (
                        <div className="p-3 text-center bg-gray-100 dark:bg-gray-700/30 text-gray-600 dark:text-gray-300 rounded-md">
                            The submission window for results has closed.
                        </div>
                    )}

                    <div className="mt-6">
                        <h3 className="text-lg font-semibold">Your Submitted Results ({results.length}/{subChallenge.submission_limit || '∞'})</h3>
                        <div className="mt-2 space-y-2">
                            {results.length > 0 ? results.map(result => (
                                <div key={result.id} className="p-3 border rounded-md dark:border-gray-700 flex justify-between items-start">
                                    <div>
                                        <p className="font-mono text-sm">{result.value}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{result.type} - Submitted as {result.trainee_tier}</p>
                                    </div>
                                    {canSubmitResults && (
                                        <button onClick={() => handleDeleteResult(result.id)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Delete</button>
                                    )}
                                </div>
                            )) : <p className="text-sm text-gray-500 dark:text-gray-400">You have not submitted any results yet.</p>}
                        </div>
                    </div>
                </Card>
            )}

            {activeTab === 'report' && rules.report.enabled && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold">Report Submission</h2>
                         <div className="text-right">
                             <p className={`text-sm font-semibold ${canSubmitReport ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {canSubmitReport ? 'Open' : 'Closed'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{timeLeft.report}</p>
                        </div>
                    </div>
                    {canSubmitReport ? (
                        <form onSubmit={handleReportSubmit} className="space-y-4">
                             <div>
                                <label htmlFor="reportFile" className={labelClasses}>Upload Your Report File</label>
                                <input
                                    id="reportFile"
                                    type="file"
                                    onChange={handleFileChange}
                                    disabled={submitting}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300 dark:hover:file:bg-blue-800/30"
                                />
                                {existingReportName && <p className="text-xs text-gray-500 mt-2">Currently submitted: <strong>{existingReportName}</strong></p>}
                             </div>
                            <div className="text-right">
                                <Button type="submit" disabled={submitting || !reportFile}>
                                    {submitting ? 'Uploading...' : (existingReportName ? 'Upload & Replace Report' : 'Upload Report')}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="p-3 text-center bg-gray-100 dark:bg-gray-700/30 text-gray-600 dark:text-gray-300 rounded-md">
                            The submission window for reports has closed.
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};
