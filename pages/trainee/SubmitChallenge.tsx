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
    
    const handleReportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reportFile) {
            setErrorMessage("Please select a report file to upload.");
            return;
        }
        setSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        if (!currentUser.auth_id) {
            setErrorMessage("Authentication error. Please try logging out and in again.");
            setSubmitting(false);
            return;
        }

        const filePath = `${currentUser.auth_id}/${subChallengeId}/${uuidv4()}-${reportFile.name}`;
        const { error: uploadError } = await supabase.storage.from('reports').upload(filePath, reportFile);

        if (uploadError) {
            setErrorMessage(`Error uploading report: ${uploadError.message}`);
            setSubmitting(false);
            return;
        }
        
        const reportFileData = { path: filePath, name: reportFile.name };

        const { data: latestSubmission, error: fetchError } = await supabase
            .from('submissions')
            .select('id, report_file')
            .eq('sub_challenge_id', subChallengeId!)
            .eq('trainee_id', currentUser.id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            setErrorMessage(`Could not verify submission status: ${fetchError.message}`);
            setSubmitting(false);
            return;
        }
        
        let dbError = null;

        if (latestSubmission) { // UPDATE existing submission
            // Remove old file from storage if it exists
            if (latestSubmission.report_file) {
                const oldPath = (latestSubmission.report_file as {path: string}).path;
                const { error: removeError } = await supabase.storage.from('reports').remove([oldPath]);
                if (removeError) {
                   console.warn(`Could not remove the old report file: ${removeError.message}`);
                }
            }

            const { error: updateError } = await supabase
                .from('submissions')
                .update({ report_file: reportFileData as unknown as Json, submitted_at: new Date().toISOString() })
                .eq('id', latestSubmission.id);
            dbError = updateError;

        } else { // INSERT new submission
            const { error: insertError } = await supabase
                .from('submissions')
                .insert([{
                    sub_challenge_id: subChallengeId!,
                    trainee_id: currentUser.id,
                    report_file: reportFileData as unknown as Json,
                }]);
            dbError = insertError;
        }

        if (dbError) {
            setErrorMessage(`Error saving report submission: ${dbError.message}`);
        } else {
            setSuccessMessage('Report uploaded successfully!');
            setReportFile(null);
            await fetchSubmission();
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
    
    const inputClasses = "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2";
    const labelClasses = "block mb-1 font-medium";

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <BackButton to={`/batch/${batchId}/level/4/trainee/sub-challenge/${subChallenge.id}`} text="Back to Challenge Details" />
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
                
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button onClick={() => setActiveTab('results')} className={`${activeTab === 'results' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                            Prior Art Results
                        </button>
                        {rules.report.enabled && (
                            <button onClick={() => setActiveTab('report')} className={`${activeTab === 'report' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Search Report
                            </button>
                        )}
                    </nav>
                </div>

                {activeTab === 'results' && (
                    <div className="py-6">
                        <h2 className="text-xl font-semibold mb-4">Submitted Results ({results.length}/{subChallenge.submission_limit ?? 'Unlimited'})</h2>
                        <div className="space-y-4 mb-6">
                            {results.map(result => (
                                <div key={result.id} className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="flex-grow">
                                        <p className="font-mono text-sm">{result.value}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{result.type} - {result.trainee_tier}</p>
                                        {result.submitted_at && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Submitted: {new Date(result.submitted_at).toLocaleString()}</p>}
                                    </div>
                                </div>
                            ))}
                            {results.length === 0 && <p className="text-center text-gray-500 py-4">No results submitted yet.</p>}
                        </div>

                        {(!subChallenge.submission_limit || results.length < subChallenge.submission_limit) && (
                            <form onSubmit={handleResultSubmit} className={`p-4 border-t dark:border-gray-700 ${isResultsDisabled ? 'opacity-50' : ''}`}>
                                 <h3 className="font-medium mb-2">Add New Result</h3>
                                 <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                    Each result submitted is final and cannot be changed or removed.
                                </p>
                                 <div className="space-y-4">
                                    <div>
                                        <label htmlFor="newResultValue" className={labelClasses}>Result (e.g., Patent Number, URL)</label>
                                        <input id="newResultValue" type="text" value={newResultValue} onChange={e => setNewResultValue(e.target.value)} placeholder="US-1234567-B2" className={inputClasses} disabled={isResultsDisabled} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="newResultType" className={labelClasses}>Result Type</label>
                                            <select id="newResultType" value={newResultType} onChange={e => setNewResultType(e.target.value as ResultType)} className={inputClasses} disabled={isResultsDisabled}>
                                                {Object.values(ResultType).map(type => <option key={type} value={type}>{type}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="newResultTier" className={labelClasses}>Tier Category</label>
                                            <select id="newResultTier" value={newResultTier} onChange={e => setNewResultTier(e.target.value as ResultTier)} className={inputClasses} disabled={isResultsDisabled}>
                                                {Object.values(ResultTier).map(tier => <option key={tier} value={tier}>{tier}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Button type="submit" disabled={isResultsDisabled || !newResultValue.trim() || submitting}>
                                            {submitting ? 'Submitting...' : '+ Submit Result'}
                                        </Button>
                                    </div>
                                 </div>
                            </form>
                        )}
                    </div>
                )}

                {activeTab === 'report' && rules.report.enabled && (
                    <form onSubmit={handleReportSubmit} className="py-6">
                        <h2 className="text-xl font-semibold mb-4">Upload Search Report</h2>
                        <div className={`p-4 border rounded-lg dark:border-gray-700 ${isReportDisabled ? 'opacity-50' : ''}`}>
                            {existingReportName && !reportFile && (
                                <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                                    Current file: <span className="font-semibold">{existingReportName}</span>
                                </p>
                            )}
                            <label htmlFor="reportFile" className={`block text-sm font-medium text-gray-700 dark:text-gray-300 ${labelClasses}`}>
                                {existingReportName ? 'Upload a new file to replace the old one' : 'Upload your report'}
                            </label>
                            <input 
                                id="reportFile" 
                                type="file" 
                                onChange={(e) => { if (e.target.files) setReportFile(e.target.files[0]); }}
                                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300 dark:hover:file:bg-blue-800/30"
                                disabled={isReportDisabled}
                            />
                            {reportFile && (
                                <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                                    New file selected: <span className="font-semibold">{reportFile.name}</span>
                                </p>
                            )}
                        </div>
                         <div className="pt-6 mt-6 border-t dark:border-gray-700 flex justify-end">
                            <Button type="submit" disabled={isReportDisabled || !reportFile || submitting}>
                                {submitting ? 'Uploading...' : 'Upload Report'}
                            </Button>
                        </div>
                    </form>
                )}

            </Card>
        </div>
    );
};