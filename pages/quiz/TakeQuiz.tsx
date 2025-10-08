import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Profile, QuizWithQuestions, QuizAnswer, QuizOption, QuizQuestion } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TablesInsert } from '../../database.types';

interface TakeQuizProps {
    currentUser: Profile;
}

const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export const TakeQuiz: React.FC<TakeQuizProps> = ({ currentUser }) => {
    const { quizId } = useParams<{ quizId: string }>();
    const navigate = useNavigate();

    const [quiz, setQuiz] = useState<QuizWithQuestions | null>(null);
    const [shuffledQuestions, setShuffledQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [answers, setAnswers] = useState<QuizAnswer[]>([]);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchQuiz = async () => {
            if (!quizId) return;
            setLoading(true);

            // Check for existing submission first
            const { data: existingSubmission, error: submissionError } = await supabase
                .from('quiz_submissions')
                .select('id')
                .eq('quiz_id', quizId)
                .eq('participant_id', currentUser.id)
                .single();
            
            if (submissionError && submissionError.code !== 'PGRST116') {
                 setError(submissionError.message);
                 setLoading(false);
                 return;
            }

            if (existingSubmission) {
                navigate('/quiz'); // Already taken, redirect
                return;
            }

            const { data, error } = await supabase
                .from('quizzes')
                .select('*, quiz_questions(*)')
                .eq('id', quizId)
                .single();

            if (error) {
                setError(error.message);
            } else if (data) {
                if (data.status !== 'live') {
                    setError('This quiz is not currently live.');
                    navigate('/quiz');
                    return;
                }
                const quizData = data as QuizWithQuestions;
                setQuiz(quizData);
                setShuffledQuestions(shuffleArray(quizData.quiz_questions));
            }
            setLoading(false);
        };
        fetchQuiz();
    }, [quizId, currentUser.id, navigate]);
    
    const currentQuestion = useMemo(() => {
        return shuffledQuestions[currentQuestionIndex];
    }, [shuffledQuestions, currentQuestionIndex]);

    const handleNext = () => {
        if (!selectedOptionId || !currentQuestion) return;

        const isCorrect = selectedOptionId === currentQuestion.correct_option_id;
        const newAnswer: QuizAnswer = {
            question_id: currentQuestion.id,
            selected_option_id: selectedOptionId,
            is_correct: isCorrect,
        };

        const updatedAnswers = [...answers, newAnswer];
        setAnswers(updatedAnswers);
        
        // Check if it's the last question
        if (currentQuestionIndex === shuffledQuestions.length - 1) {
            handleSubmit(updatedAnswers);
        } else {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOptionId(null);
        }
    };

    const handleSubmit = async (finalAnswers: QuizAnswer[]) => {
        setSubmitting(true);
        const score = finalAnswers.filter(a => a.is_correct).length;
        
        const submissionData: TablesInsert<'quiz_submissions'> = {
            quiz_id: quizId!,
            participant_id: currentUser.id,
            score,
            answers: finalAnswers as any,
        };

        const { error } = await supabase.from('quiz_submissions').insert(submissionData);

        if (error) {
            setError(`Failed to submit quiz: ${error.message}`);
            setSubmitting(false);
        } else {
            // Success, navigate to dashboard
            navigate('/quiz');
        }
    };
    
    if (loading) return <div className="p-8">Loading quiz...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!quiz || !currentQuestion) return <div className="p-8 text-center">Quiz not found or has no questions.</div>;

    const options = currentQuestion.options as unknown as QuizOption[];

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
            <Card className="w-full max-w-2xl">
                <div className="pb-4 mb-6 border-b dark:border-gray-700">
                    <h1 className="text-2xl font-bold text-center">{quiz.title}</h1>
                    <p className="text-center text-gray-500 dark:text-gray-400 mt-2">
                        Question {currentQuestionIndex + 1} of {shuffledQuestions.length}
                    </p>
                </div>
                
                <h2 className="text-xl font-semibold mb-6">{currentQuestion.question_text}</h2>
                
                <div className="space-y-4">
                    {options.map(option => (
                        <button
                            key={option.id}
                            onClick={() => setSelectedOptionId(option.id)}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-colors duration-200 ${
                                selectedOptionId === option.id 
                                ? 'bg-blue-100 border-blue-500 dark:bg-blue-900/40' 
                                : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600'
                            }`}
                        >
                            {option.text}
                        </button>
                    ))}
                </div>
                
                <div className="mt-8 pt-6 border-t dark:border-gray-700 flex justify-end">
                    <Button 
                        onClick={handleNext} 
                        disabled={!selectedOptionId || submitting}
                        className="w-48"
                    >
                        {submitting ? 'Submitting...' :
                         currentQuestionIndex === shuffledQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                    </Button>
                </div>
            </Card>
        </div>
    );
};
