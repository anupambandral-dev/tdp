
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Profile, ResultEvaluation, ResultTier, SubmittedResult, IncorrectMarking, SubChallenge, Submission, Evaluation, EvaluationRules, SubmissionWithProfile, SubChallengeWithSubmissions, Json } from '../../types';

interface EvaluateSubmissionProps {
    currentUser: Profile;
}

export const EvaluateSubmission: React.FC<EvaluateSubmissionProps> = ({ currentUser }) => {
    const { challengeId } = useParams();
    const navigate = useNavigate();
    const [challenge, setChallenge] = useState<SubChallengeWithSubmissions | null>(null);
    const [loading, setLoading] = useState(true);

    const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
    
    const selectedSubmission = useMemo(() => {
        return challenge?.submissions?.find(s => s.trainee_id === selectedTraineeId);
    }, [challenge, selectedTraineeId]);
    
    const [resultEvals, setResultEvals] = useState<ResultEvaluation[]>([]);
    const [reportScore, setReportScore] = useState<number | string>('');
    const [feedback, setFeedback] = useState<string>('');
    
    useEffect(() => {
        const fetchChallenge = async () => {
            if (!challengeId) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('sub_challenges')
                .select('*, submissions(*, profiles(id, name, avatar_url, email, role))')
                .eq('id', challengeId)
                .single<SubChallengeWithSubmissions>();
            
            if (error) {
                console.error(error);
            } else if (data) {
                setChallenge(data);
                if (data.submissions && data.submissions.length > 0) {
                    const firstUnevaluated = data.submissions.find((s) => !s.evaluation);
                    if (firstUnevaluated) {
                        setSelectedTraineeId(firstUnevaluated.trainee_id);
                    } else {
                        setSelectedTraineeId(data.submissions[0].trainee_id);
                    }
                }
            }
            setLoading(false);
        };
        fetchChallenge();
    }, [challengeId]);

    useEffect(() => {
        if (selectedSubmission) {
            const currentEval = selectedSubmission.evaluation as unknown as Evaluation | null;
            const currentResults = selectedSubmission.results as unknown as SubmittedResult[] | null;

            setResultEvals(currentEval?.result_evaluations || currentResults?.map(r => ({ result_id: r.id, evaluator_tier: r.trainee_tier })) || []);
            setReportScore(currentEval?.report_score ?? '');
            setFeedback(currentEval?.feedback || '');
        }
    }, [selectedSubmission]);

    if (loading) return <div className="p-8">Loading submission data...</div>;
    if (!challenge) return <div className="text-center p-8">Challenge not found.</div>;

    const rules = challenge.evaluation_rules as unknown as EvaluationRules;

    const handleEvalChange = (resultId: string, evaluatorTier: ResultTier) => {
        setResultEvals(prev => prev.map(e => e.result_id === resultId ? {...e, evaluator_tier: evaluatorTier} : e));
    };
    
    const getScoreForResult = (result: SubmittedResult) => {
      const evaluation = resultEvals.find(re => re.result_id === result.id);
      if (evaluation) {
        if (result.trainee_tier === evaluation.evaluator_tier) {
          return { score: rules.tierScores[result.trainee_tier as ResultTier] || 0, status: 'Correct' };
        } else {
            const traineeTierIndex = Object.values(ResultTier).indexOf(result.trainee_tier);
            const evaluatorTierIndex = Object.values(ResultTier).indexOf(evaluation.evaluator_tier);
            const status = evaluatorTierIndex < traineeTierIndex ? 'Upgraded' : 'Downgraded';
            if (rules.incorrectMarking === IncorrectMarking.PENALTY) {
                return { score: rules.incorrectPenalty, status };
            }
            return { score: 0, status };
        }
      }
      return { score: 0, status: 'N/A' };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedSubmission) {
            alert('Cannot save evaluation. No submission selected.');
            return;
        }

        setLoading(true);
        const newEvaluation: Evaluation = {
            evaluator_id: currentUser.id,
            result_evaluations: resultEvals,
            report_score: rules.report.enabled ? Number(reportScore) : undefined,
            feedback: feedback,
            evaluated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('submissions')
            .update({ evaluation: newEvaluation as Json }) 
            .eq('id', selectedSubmission.id);

        if (error) {
            alert(`Error saving evaluation: ${error.message}`);
        } else {
            alert('Evaluation saved successfully!');
            const currentIndex = challenge.submissions.findIndex(s => s.trainee_id === selectedTraineeId);
            const nextUnevaluated = challenge.submissions.find((s, index) => index > currentIndex && !s.evaluation);

            if(nextUnevaluated) {
                setSelectedTraineeId(nextUnevaluated.trainee_id);
                setChallenge(prev => {
                    if (!prev) return prev;
                    const newSubmissions = prev.submissions.map(s =>
                        s.id === selectedSubmission.id ? { ...s, evaluation: newEvaluation as any } : s
                    );
                    return { ...prev, submissions: newSubmissions };
                });
            } else {
                 navigate('/evaluator');
            }
        }
        setLoading(false);
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <Link to="/evaluator" className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">&larr; Back to Dashboard</Link>
            <h1 className="text-3xl font-bold mb-2">{challenge.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Evaluation Portal</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    <h2 className="text-xl font-semibold mb-4">Submissions</h2>
                    <Card>
                        <ul className="space-y-2">
                           {challenge.submissions.map(submission => {
                               const trainee = submission.profiles;
                               const isEvaluated = !!submission.evaluation;
                               return (
                                   <li key={submission.trainee_id}>
                                       <button 
                                            className={`w-full text-left p-3 rounded-lg flex items-center space-x-3 transition-colors ${selectedTraineeId === submission.trainee_id ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                            onClick={() => setSelectedTraineeId(submission.trainee_id)}
                                        >
                                           <img src={trainee?.avatar_url || ''} alt={trainee?.name} className="w-8 h-8 rounded-full" />
                                           <span className="font-medium flex-grow">{trainee?.name}</span>
                                           {isEvaluated && <span className="text-green-500 text-xs font-bold">✓</span>}
                                       </button>
                                   </li>
                               )
                           })}
                        </ul>
                    </Card>
                </div>
                <div className="md:col-span-2">
                {selectedSubmission ? (
                    <Card>
                        <div className="mb-6">
                            <h2 className="text-2xl font-semibold">Evaluating: {selectedSubmission.profiles?.name}</h2>
                            <p className="text-sm text-gray-500">Submitted at: {new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                          <div>
                            <h3 className="font-semibold mb-2">Submitted Results</h3>
                            <div className="space-y-3">
                              {(selectedSubmission.results as unknown as SubmittedResult[] | null)?.map(result => {
                                const evalTier = resultEvals.find(e => e.result_id === result.id)?.evaluator_tier || result.trainee_tier;
                                const { score, status } = getScoreForResult(result);
                                const statusColor = status === 'Correct' ? 'text-green-500' : 'text-orange-500';
                                return (
                                <div key={result.id} className="p-3 border rounded-lg dark:border-gray-700 space-y-2">
                                  <p className="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">{result.value}</p>
                                  <div className="flex justify-between items-center text-sm">
                                      <p>Trainee categorized as: <span className="font-semibold">{result.trainee_tier}</span> ({result.type})</p>
                                      <div className="flex items-center gap-2">
                                        <label>Correct Tier:</label>
                                        <select value={evalTier} onChange={e => handleEvalChange(result.id, e.target.value as ResultTier)} className="input !py-1">
                                          {Object.values(ResultTier).map(tier => <option key={tier} value={tier}>{tier}</option>)}
                                        </select>
                                      </div>
                                  </div>
                                  <div className={`text-right font-bold text-sm ${statusColor}`}>{status} ({score} pts)</div>
                                </div>
                              )})}
                            </div>
                          </div>
                          
                          {rules.report.enabled && (
                            <div>
                                <label htmlFor="reportScore" className="flex justify-between items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <span>Report Evaluation</span>
                                    {(selectedSubmission.report_file as { path: string, name: string } | null)?.path && <a href={supabase.storage.from('reports').getPublicUrl((selectedSubmission.report_file as any).path).data.publicUrl} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">View Report: {(selectedSubmission.report_file as any)?.name}</a>}
                                </label>
                                <input 
                                    type="number" 
                                    id="reportScore"
                                    max={rules.report.maxScore}
                                    min={0}
                                    value={reportScore}
                                    onChange={(e) => setReportScore(e.target.value)}
                                    placeholder={`Score / ${rules.report.maxScore}`}
                                    className="mt-1 block w-full input"
                                />
                            </div>
                          )}

                            <div>
                                <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Overall Feedback</label>
                                <textarea id="feedback" rows={4} className="mt-1 block w-full input" value={feedback} onChange={e => setFeedback(e.target.value)} />
                            </div>
                            <div className="text-right">
                                <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save & Next'}</Button>
                            </div>
                        </form>
                    </Card>
                    ) : (
                    <Card className="text-center py-12">
                        <p className="text-gray-500">Select a trainee to start evaluation.</p>
                    </Card>
                    )}
                </div>
            </div>
            <style>{`.input { border-radius: 0.375rem; border: 1px solid #D1D5DB; padding: 0.5rem 0.75rem; } .dark .input { background-color: #374151; border-color: #4B5563; }`}</style>
        </div>
    );
};