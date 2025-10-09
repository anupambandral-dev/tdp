import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Profile, Role, QuizWithSubmission, QuizStatus, QuizStatusEnum } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';

interface QuizDashboardProps {
    currentUser: Profile;
}

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

const getStatusBadge = (status: QuizStatus, hasSubmitted: boolean) => {
    if (hasSubmitted) return { text: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    switch (status) {
        case QuizStatusEnum.DRAFT: return { text: 'Not Started', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' };
        case QuizStatusEnum.LIVE: return { text: 'Live', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse' };
        case QuizStatusEnum.ENDED: return { text: 'Ended', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' };
        default: return { text: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    }
};

export const QuizDashboard: React.FC<QuizDashboardProps> = ({ currentUser }) => {
    const { batchId } = useParams<{ batchId: string }>();
    const [quizzes, setQuizzes] = useState<QuizWithSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isManager = currentUser.role === Role.MANAGER;

    useEffect(() => {
        const fetchQuizzes = async () => {
            if (!batchId) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('quizzes')
                .select('*, quiz_submissions(id, participant_id)')
                .eq('batch_id', batchId)
                .order('created_at', { ascending: false });

            if (error) {
                setError(error.message);
                console.error("Error fetching quizzes:", error);
            } else {
                setQuizzes(data as QuizWithSubmission[]);
            }
            setLoading(false);
        };
        fetchQuizzes();
        
        const channel = supabase
          .channel(`quiz-dashboard-${batchId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'quizzes', filter: `batch_id=eq.${batchId}` },
            () => fetchQuizzes()
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };

    }, [batchId]);

    const getTraineeAction = (quiz: QuizWithSubmission) => {
        const hasSubmitted = quiz.quiz_submissions.some(s => s.participant_id === currentUser.id);
        if (hasSubmitted) {
            return <span className="font-semibold text-green-600">Completed</span>;
        }
        if (quiz.status === QuizStatusEnum.LIVE) {
            return (
                <Link to={`/batch/${batchId}/quiz/take/${quiz.id}`}>
                    <Button>Start Quiz</Button>
                </Link>
            );
        }
        return <Button disabled>Not Available</Button>;
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to={`/batch/${batchId}`} text="Back to Batch Dashboard" />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Quiz Dashboard</h1>
                {isManager && (
                    <Link to={`/batch/${batchId}/quiz/create`}>
                        <Button><PlusIcon /> Create New Quiz</Button>
                    </Link>
                )}
            </div>
            {loading && <p>Loading quizzes...</p>}
            {error && <p className="text-red-500">Error: {error}</p>}
            {!loading && !error && (
                <div className="space-y-4">
                    {quizzes.length === 0 ? (
                        <Card className="text-center py-10">
                            <p className="text-gray-500">{isManager ? "No quizzes created for this batch yet." : "No quizzes are available for this batch yet."}</p>
                        </Card>
                    ) : (
                        quizzes.map(quiz => {
                            const hasSubmitted = quiz.quiz_submissions.some(s => s.participant_id === currentUser.id);
                            const badge = getStatusBadge(quiz.status, hasSubmitted);
                            return (
                                <Card key={quiz.id} className="flex justify-between items-center">
                                    <div>
                                        <h2 className="text-xl font-semibold">{quiz.title}</h2>
                                        <p className="text-sm text-gray-500">Created: {new Date(quiz.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${badge.color}`}>{badge.text}</span>
                                        {isManager ? (
                                            <Link to={`/batch/${batchId}/quiz/manage/${quiz.id}`}>
                                                <Button>Manage</Button>
                                            </Link>
                                        ) : (
                                            getTraineeAction(quiz)
                                        )}
                                    </div>
                                </Card>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    );
};
