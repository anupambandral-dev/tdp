
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { MOCK_CHALLENGES } from '../../constants';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SubmittedResult, ResultType, ResultTier, User, Submission } from '../../types';

const UploadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
);
const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gray-500 hover:text-red-500"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);

interface SubmitChallengeProps {
    currentUser: User;
}

export const SubmitChallenge: React.FC<SubmitChallengeProps> = ({ currentUser }) => {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const challenge = MOCK_CHALLENGES.flatMap(c => c.sub_challenges).find(sc => sc.id === challengeId);
  
  const [results, setResults] = useState<Omit<SubmittedResult, 'trainee_tier'> & { trainee_tier: ResultTier }[]>([{ id: uuidv4(), value: '', type: ResultType.PATENT, trainee_tier: ResultTier.TIER_1 }]);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    if (!challenge) return;
    const interval = setInterval(() => {
      const endTime = new Date(challenge.submission_end_time).getTime();
      const now = new Date().getTime();
      const distance = endTime - now;
      
      if (distance < 0) {
        setTimeLeft('Submission Closed');
        setIsOver(true);
        clearInterval(interval);
        return;
      }
      
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      
      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge]);

  if (!challenge) {
    return <div className="text-center p-8">Challenge not found.</div>;
  }
  
  const handleResultChange = (id: string, field: keyof SubmittedResult, value: any) => {
    setResults(results.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  
  const addResult = () => {
    setResults([...results, { id: uuidv4(), value: '', type: ResultType.PATENT, trainee_tier: ResultTier.TIER_1 }]);
  }

  const removeResult = (id: string) => {
    if (results.length > 1) {
      setResults(results.filter(r => r.id !== id));
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.some(r => r.value.trim() === '')) {
      alert('Please ensure all result fields are filled out.');
      return;
    }

    if (!challenge) {
        alert('Could not find challenge to submit to.');
        return;
    }

    const newSubmission: Omit<Submission, 'id' | 'created_at' | 'sub_challenge_id'> = {
        trainee_id: currentUser.id,
        submitted_at: new Date().toISOString(),
        results: results,
        report_file: reportFile ? { name: reportFile.name, path: '#' } : undefined,
    };
    
    // Find and update the sub-challenge in our mock data.
    const overallChallenge = MOCK_CHALLENGES.find(oc => oc.id === challenge.overall_challenge_id);
    if (!overallChallenge) return;

    const subChallenge = overallChallenge.sub_challenges.find(sc => sc.id === challenge.id);
    if (!subChallenge) return;
    
    // Check if a submission for this user already exists.
    const existingSubmissionIndex = subChallenge.submissions.findIndex(s => s.trainee_id === currentUser.id);

    const submissionToSave: Submission = {
      ...newSubmission,
      id: existingSubmissionIndex !== -1 ? subChallenge.submissions[existingSubmissionIndex].id : uuidv4(),
      created_at: existingSubmissionIndex !== -1 ? subChallenge.submissions[existingSubmissionIndex].created_at : new Date().toISOString(),
      sub_challenge_id: challenge.id
    }


    if (existingSubmissionIndex !== -1) {
        // Update existing submission
        subChallenge.submissions[existingSubmissionIndex] = submissionToSave;
    } else {
        // Add new submission
        subChallenge.submissions.push(submissionToSave);
    }
    
    alert('Submission successful! (Simulated)');
    navigate('/trainee');
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
      <Link to="/trainee" className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">&larr; Back to Dashboard</Link>
      <Card>
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold">{challenge.title}</h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 mt-1">Patent: {challenge.patent_number}</p>
          <div className={`mt-4 text-xl font-bold p-2 rounded-lg inline-block ${isOver ? 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900' : 'text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900'}`}>
            Time Remaining: {timeLeft}
          </div>
        </div>
        <div className="my-6 border-t dark:border-gray-700"></div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Submitted Results
            </label>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={result.id} className="p-3 border rounded-lg dark:border-gray-700 flex flex-wrap items-center gap-4">
                  <input 
                    type="text"
                    placeholder="Enter Patent Number or NPL"
                    value={result.value}
                    onChange={e => handleResultChange(result.id, 'value', e.target.value)}
                    className="flex-grow input"
                    disabled={isOver}
                  />
                  <select value={result.type} onChange={e => handleResultChange(result.id, 'type', e.target.value)} className="input w-48" disabled={isOver}>
                    {Object.values(ResultType).map(rt => <option key={rt} value={rt}>{rt}</option>)}
                  </select>
                  <select value={result.trainee_tier} onChange={e => handleResultChange(result.id, 'trainee_tier', e.target.value)} className="input w-32" disabled={isOver}>
                    {Object.values(ResultTier).map(tier => <option key={tier} value={tier}>{tier}</option>)}
                  </select>
                  <button type="button" onClick={() => removeResult(result.id)} disabled={results.length <= 1 || isOver} className="disabled:opacity-50">
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" onClick={addResult} className="mt-2 text-sm !py-1 !px-2" disabled={isOver}>
              + Add Result
            </Button>
          </div>
          
          {challenge.evaluation_rules.report.enabled && (
            <div>
              <label htmlFor="reportFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Upload Report
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <UploadIcon />
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={e => setReportFile(e.target.files ? e.target.files[0] : null)} disabled={isOver} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{reportFile ? reportFile.name : 'PDF, DOCX up to 10MB'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="text-right">
            <Button type="submit" disabled={isOver}>Submit</Button>
          </div>
        </form>
      </Card>
      <style>{`
          .input {
              display: block;
              border-radius: 0.375rem;
              border: 1px solid #D1D5DB;
              box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
              padding: 0.5rem 0.75rem;
              background-color: white;
          }
          .dark .input {
              background-color: #374151;
              border-color: #4B5563;
          }
      `}</style>
    </div>
  );
};
