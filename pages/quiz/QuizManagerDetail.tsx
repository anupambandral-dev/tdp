import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Quiz, QuizSubmissionWithProfile } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';

export const QuizManagerDetail: React.FC = () => {
    const { quizId } = useParams<{ quizId: string }>();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [submissions, setSubmissions] = useState<QuizSubmissionWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const fetchQuizDetails = async () => {
            if (!quizId) return;
            setLoading(true);

            const quizPromise = supabase.from('quizzes').select('*').eq('id', quizId).single();
            const submissionsPromise = supabase.from('quiz_submissions').select('*, profiles(*)').eq('quiz_id', quizId).order('score', { ascending: false });

            const [quizResult, submissionsResult] = await Promise.all([quizPromise, submissionsPromise]);

            if (quizResult.error) {
                setError(quizResult.error.message);
                console.error("Error fetching quiz:", quizResult.error);
            } else {
                setQuiz(quizResult.data);
            }

            if (submissionsResult.error) {
                setError(submissionsResult.error.message);
                console.error("Error fetching submissions:", submissionsResult.error);
            } else {
                setSubmissions(submissionsResult.data as QuizSubmissionWithProfile[]);
            }

            setLoading(false);
        };
        
        fetchQuizDetails();

        const channel = supabase
            .channel(`quiz-details-${quizId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_submissions', filter: `quiz_id=eq.${quizId}` }, (payload) => {
                fetchQuizDetails(); // Refetch all on change
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quizzes', filter: `id=eq.${quizId}` }, (payload) => {
                 setQuiz(payload.new as Quiz);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [quizId]);

    const handleUpdateStatus = async (status: 'live' | 'ended') => {
        setIsUpdating(true);
        setError(null);
        const { error } = await supabase
            .from('quizzes')
            .update({ status })
            .eq('id', quizId!);

        if (error) {
            setError(error.message);
        }
        setIsUpdating(false);
    };

    if (loading) return <div className="p-8">Loading quiz details...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!quiz) return <div className="p-8 text-center">Quiz not found.</div>;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to="/quiz" text="Back to Quiz Dashboard" />
            
            <Card className="mb-8">
                <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">{quiz.title}</h1>
                        <p className="text-gray-500 dark:text-gray-400 capitalize">Status: <span className="font-bold">{quiz.status}</span></p>
                    </div>
                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                        {quiz.status === 'draft' && (
                            <Button onClick={() => handleUpdateStatus('live')} disabled={isUpdating} variant="primary">
                                {isUpdating ? 'Starting...' : 'Start Quiz'}
                            </Button>
                        )}
                        {quiz.status === 'live' && (
                            <Button onClick={() => handleUpdateStatus('ended')} disabled={isUpdating} variant="danger">
                                {isUpdating ? 'Ending...' : 'End Quiz'}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            <h2 className="text-2xl font-semibold mb-4">Results & Leaderboard</h2>
            <Card>
                {submissions.length === 0 ? (
                    <p className="text-center text-gray-500 py-10">No submissions have been made yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed At</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {submissions.map((sub, index) => (
                                    <tr key={sub.id}>
                                        <td className="px-6 py-4 whitespace-nowrap font-bold">{index + 1}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{sub.profiles?.name || 'Unknown'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-semibold">{sub.score}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(sub.completed_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};
