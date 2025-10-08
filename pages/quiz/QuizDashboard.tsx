import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Profile, Role, Quiz, QuizSubmission } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';

interface QuizDashboardProps {
    currentUser: Profile;
}

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

// Helper to get trainee status for a quiz
const getTraineeQuizStatus = (quiz: Quiz, submissions: QuizSubmission[]) => {
    const hasSubmitted = submissions.some(s => s.quiz_id === quiz.id);
    if (hasSubmitted) return { text: 'Completed', color: 'green' };
    if (quiz.status === 'live') return { text: 'Live', color: 'blue' };
    if (quiz.status === 'ended') return { text: 'Ended', color: 'gray' };
    return { text: 'Not Started', color: 'yellow' };
};

export const QuizDashboard: React.FC<QuizDashboardProps> = ({ currentUser }) => {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [mySubmissions, setMySubmissions] = useState<QuizSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuizzes = async () => {
            const { data, error } = await supabase
                .from('quizzes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                setError(error.message);
                console.error("Error fetching quizzes:", error);
            } else {
                setQuizzes(data);
            }
        };

        const fetchSubmissions = async () => {
            if (currentUser.role === Role.TRAINEE) {
                const { data, error } = await supabase
                    .from('quiz_submissions')
                    .select('*')
                    .eq('participant_id', currentUser.id);
                
                if (error) {
                    console.error("Error fetching submissions:", error);
                } else {
                    setMySubmissions(data);
                }
            }
        };
        
        const initialFetch = async () => {
            setLoading(true);
            await Promise.all([fetchQuizzes(), fetchSubmissions()]);
            setLoading(false);
        };

        initialFetch();

        const channel = supabase
            .channel('public:quizzes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, (payload) => {
                fetchQuizzes();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [currentUser.id, currentUser.role]);

    const ManagerView = () => (
        <>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Quiz Dashboard</h1>
                <Link to="/quiz/create">
                    <Button><PlusIcon />Create New Quiz</Button>
                </Link>
            </div>
            {quizzes.length === 0 ? (
                 <Card className="text-center py-10">
                     <p className="text-gray-500">You haven't created any quizzes yet.</p>
                 </Card>
            ) : (
                <div className="space-y-4">
                    {quizzes.map(quiz => (
                        <Card key={quiz.id} className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-semibold">{quiz.title}</h2>
                                <p className="text-sm text-gray-500">Status: <span className="font-bold">{quiz.status}</span></p>
                            </div>
                            <Button onClick={() => navigate(`/quiz/manage/${quiz.id}`)}>
                                Manage & View Results
                            </Button>
                        </Card>
                    ))}
                </div>
            )}
        </>
    );

    const TraineeView = () => (
         <>
            <h1 className="text-3xl font-bold mb-6">Available Quizzes</h1>
             {quizzes.length === 0 ? (
                 <Card className="text-center py-10">
                     <p className="text-gray-500">There are no quizzes available at the moment.</p>
                 </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map(quiz => {
                        const status = getTraineeQuizStatus(quiz, mySubmissions);
                        const canTakeQuiz = status.text === 'Live';
                        
                        return (
                            <Card key={quiz.id} className="flex flex-col">
                                <div className="flex-grow">
                                    <div className="flex justify-between items-start">
                                        <h2 className="text-xl font-semibold">{quiz.title}</h2>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            status.color === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                            status.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                            status.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                        }`}>
                                            {status.text}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-6">
                                     <Button 
                                        className="w-full" 
                                        onClick={() => navigate(`/quiz/take/${quiz.id}`)}
                                        disabled={!canTakeQuiz}
                                    >
                                        {status.text === 'Completed' ? 'View Score' : 'Take Quiz'}
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
             )}
        </>
    );

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to="/dashboard" text="Back to Main Dashboard" />
            {loading ? (
                <p>Loading quizzes...</p>
            ) : error ? (
                <p className="text-red-500">Error: {error}</p>
            ) : (
                currentUser.role === Role.MANAGER ? <ManagerView /> : <TraineeView />
            )}
        </div>
    );
};
