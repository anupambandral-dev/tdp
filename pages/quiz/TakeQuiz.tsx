import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Profile, Quiz, QuizQuestion, QuizOption, QuizStatusEnum, QuizAnswer, Json } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface TakeQuizProps {
    currentUser: Profile;
}

export const TakeQuiz: React.FC<TakeQuizProps> = ({ currentUser }) => {
    const { batchId, quizId } = useParams<{ batchId: string; quizId: string }>();
    const navigate = useNavigate();

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [answers, setAnswers] = useState<QuizAnswer[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Randomize questions once on load
    const randomizedQuestions = useMemo(() => {
        return [...questions].sort(() => Math.random() - 0.5);
    }, [questions]);

    useEffect(() => {
        const fetchQuiz = async () => {
            if (!quizId) return;
            setLoading(true);

            // Verify user is in batch
            const { data: participantData, error: participantError } = await supabase
                .from('batch_participants')
                .select('id')
                .eq('batch_id', batchId!)
                .eq('participant_id', currentUser.id)
                .single();
            
            if (participantError || !participantData) {
                setError("You are not authorized to take this quiz.");
                setLoading(false);
                return;
            }

            // Fetch quiz and check status
            const { data: quizData, error: quizError } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
            if (quizError || !quizData) {
                setError("Quiz not found."); setLoading(false); return;
            }
            if (quizData.status !== QuizStatusEnum.LIVE) {
                setError("This quiz is not currently live."); setLoading(false); return;
            }
            setQuiz(quizData);

            // Fetch questions
            const { data: questionsData, error: questionsError } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId);
            if (questionsError) {
                setError("Failed to load questions."); setLoading(false); return;
            }
            setQuestions(questionsData);
            setLoading(false);
        };
        fetchQuiz();
    }, [quizId, batchId, currentUser.id]);

    const handleNext = () => {
        if (selectedOptionId === null) return;
        
        const newAnswer: QuizAnswer = {
            question_id: randomizedQuestions[currentQuestionIndex].id,
            selected_option_id: selectedOptionId
        };
        const newAnswers = [...answers, newAnswer];
        setAnswers(newAnswers);
        setSelectedOptionId(null);
        
        if (currentQuestionIndex < randomizedQuestions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            // End of quiz, submit answers
            submitQuiz(newAnswers);
        }
    };
    
    const submitQuiz = async (finalAnswers: QuizAnswer[]) => {
        setIsSubmitting(true);
        let score = 0;
        finalAnswers.forEach(answer => {
            const question = questions.find(q => q.id === answer.question_id);
            if (question && question.correct_option_id === answer.selected_option_id) {
                score++;
            }
        });

        // FIX: The insert method expects an array of objects, and 'answers' must be cast to Json.
        const { error } = await supabase.from('quiz_submissions').insert([{
            quiz_id: quizId!,
            participant_id: currentUser.id,
            answers: finalAnswers as unknown as Json,
            score: score,
            completed_at: new Date().toISOString(),
        }]);

        if (error) {
            setError(`Failed to submit quiz: ${error.message}`);
            setIsSubmitting(false);
        } else {
            // Submission successful, redirect
            navigate(`/batch/${batchId}/quiz`);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading quiz...</div>;
    if (error) return (
        <div className="container mx-auto p-8 max-w-2xl">
            <Card className="text-center">
                <p className="text-red-500 font-semibold mb-4">{error}</p>
                <Button onClick={() => navigate(`/batch/${batchId}/quiz`)}>Back to Quiz Dashboard</Button>
            </Card>
        </div>
    );
    if (!quiz || randomizedQuestions.length === 0) return <div className="p-8 text-center">Quiz has no questions.</div>;

    const currentQuestion = randomizedQuestions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / randomizedQuestions.length) * 100;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-2xl">
            <Card>
                <div className="mb-4">
                    <div className="flex justify-between mb-1">
                        <span className="text-base font-medium text-blue-700 dark:text-white">Question {currentQuestionIndex + 1} of {randomizedQuestions.length}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>

                <h1 className="text-2xl font-bold my-6">{currentQuestion.question_text}</h1>
                
                <div className="space-y-4">
                    {/* FIX: Cast 'options' from Json to QuizOption[] to allow accessing properties like .text */}
                    {(currentQuestion.options as unknown as QuizOption[]).map(opt => (
                        <label key={opt.id} className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${selectedOptionId === opt.id ? 'bg-blue-100 dark:bg-blue-900 border-blue-500' : 'dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <input
                                type="radio"
                                name="quiz-option"
                                checked={selectedOptionId === opt.id}
                                onChange={() => setSelectedOptionId(opt.id)}
                                className="h-5 w-5 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-3 font-medium">{opt.text}</span>
                        </label>
                    ))}
                </div>

                <div className="mt-8 flex justify-end">
                    <Button onClick={handleNext} disabled={selectedOptionId === null || isSubmitting}>
                        {isSubmitting ? 'Submitting...' : (currentQuestionIndex === randomizedQuestions.length - 1 ? 'Finish & Submit' : 'Next Question')}
                    </Button>
                </div>
            </Card>
        </div>
    );
};
