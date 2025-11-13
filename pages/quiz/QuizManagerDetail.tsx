import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
// FIX: Imported QuizStatus type to use for function parameter annotation.
import { Quiz, QuizQuestion, QuizSubmissionWithProfile, QuizStatus, QuizStatusEnum, Json, QuizOption } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';

export const QuizManagerDetail: React.FC = () => {
    const { batchId, quizId } = useParams<{ batchId: string, quizId: string }>();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [submissions, setSubmissions] = useState<QuizSubmissionWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQuizData = useCallback(async () => {
        if (!quizId) return;
        setLoading(true);
        setError(null);

        const quizPromise = supabase.from('quizzes').select('*').eq('id', quizId).single();
        const questionsPromise = supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('created_at');
        const submissionsPromise = supabase.from('quiz_submissions').select('*, profiles(*)').eq('quiz_id', quizId).order('completed_at', { ascending: false });

        const [quizResult, questionsResult, submissionsResult] = await Promise.all([quizPromise, questionsPromise, submissionsPromise]);

        if (quizResult.error) {
            setError(quizResult.error.message);
        } else {
            setQuiz(quizResult.data as Quiz);
        }

        if (questionsResult.error) {
            setError(questionsResult.error.message);
        } else {
            setQuestions(questionsResult.data as QuizQuestion[]);
        }

        if (submissionsResult.error) {
            setError(submissionsResult.error.message);
        } else {
            setSubmissions(submissionsResult.data as unknown as QuizSubmissionWithProfile[]);
        }

        setLoading(false);
    }, [quizId]);

    useEffect(() => {
        fetchQuizData();
    }, [fetchQuizData]);

    // FIX: Used the 'QuizStatus' type for the newStatus parameter instead of the 'QuizStatusEnum' value.
    const handleStatusChange = async (newStatus: QuizStatus) => {
        if (!quizId) return;
        const { error } = await supabase
            .from('quizzes')
            .update({ status: newStatus })
            .eq('id', quizId);
        
        if (error) {
            setError(error.message);
        } else {
            fetchQuizData(); // Refresh data
        }
    };
    
    const getCorrectOptionText = (question: QuizQuestion): string => {
        const options = question.options as unknown as QuizOption[];
        const correctOption = options.find(opt => opt.id === question.correct_option_id);
        return correctOption?.text || 'N/A';
    };

    if (loading) return <div className="p-8">Loading quiz details...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!quiz) return <div className="p-8 text-center">Quiz not found.</div>;

    const averageScore = submissions.length > 0
        ? (submissions.reduce((acc, sub) => acc + sub.score, 0) / submissions.length).toFixed(2)
        : "0.00";

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <BackButton to={`/batch/${batchId}/quiz`} text="Back to Quiz Dashboard" />
            <Card className="mb-6">
                <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">{quiz.title}</h1>
                        <p className={`mt-1 font-semibold text-sm ${
                            quiz.status === QuizStatusEnum.LIVE ? 'text-green-600 dark:text-green-400' :
                            quiz.status === QuizStatusEnum.ENDED ? 'text-red-600 dark:text-red-400' :
                            'text-gray-600 dark:text-gray-400'
                        }`}>
                            Status: {quiz.status.toUpperCase()}
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        {quiz.status === QuizStatusEnum.DRAFT && (
                            <Button onClick={() => handleStatusChange(QuizStatusEnum.LIVE)}>Go Live</Button>
                        )}
                         {quiz.status === QuizStatusEnum.LIVE && (
                            <Button onClick={() => handleStatusChange(QuizStatusEnum.ENDED)} variant="danger-outline">End Quiz</Button>
                        )}
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <h2 className="text-xl font-semibold mb-4">Questions ({questions.length})</h2>
                        <div className="space-y-4">
                            {questions.map((q, index) => (
                                <div key={q.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <p className="font-semibold">{index + 1}. {q.question_text}</p>
                                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">Correct Answer: {getCorrectOptionText(q)}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div>
                    <Card>
                        <h2 className="text-xl font-semibold mb-4">Submissions</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between"><span>Total Submissions:</span> <span className="font-bold">{submissions.length}</span></div>
                            <div className="flex justify-between"><span>Average Score:</span> <span className="font-bold">{averageScore} / {questions.length}</span></div>
                        </div>

                        <div className="mt-4 pt-4 border-t dark:border-gray-700">
                             <h3 className="font-semibold mb-2">Participants</h3>
                             <div className="space-y-2 max-h-80 overflow-y-auto">
                                {submissions.map(sub => (
                                    <div key={sub.id} className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-50 dark:bg-gray-700">
                                        <span>{sub.profiles?.name || 'Unknown'}</span>
                                        <span className="font-bold">{sub.score}/{questions.length}</span>
                                    </div>
                                ))}
                                {submissions.length === 0 && <p className="text-sm text-center text-gray-500 py-4">No submissions yet.</p>}
                             </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};