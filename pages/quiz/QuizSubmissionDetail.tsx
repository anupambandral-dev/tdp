import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Quiz, QuizQuestion, QuizSubmission, QuizAnswer, QuizOption, Profile } from '../../types';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';

export const QuizSubmissionDetail: React.FC = () => {
    const { batchId, submissionId } = useParams<{ batchId: string, submissionId: string }>();
    const [submission, setSubmission] = useState<QuizSubmission & { profiles: Profile | null } | null>(null);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!submissionId) {
                setError("No submission ID provided.");
                setLoading(false);
                return;
            }
            
            setLoading(true);
            console.log("Fetching submission:", submissionId);
            
            try {
                // Fetch submission
                const { data: subData, error: subError } = await supabase
                    .from('quiz_submissions')
                    .select('*')
                    .eq('id', submissionId)
                    .single();
                
                if (subError) throw subError;
                if (!subData) throw new Error("Submission not found.");

                const submissionData = subData as QuizSubmission;
                
                // Fetch profile separately for robustness
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', submissionData.participant_id)
                    .single();

                setSubmission({ ...submissionData, profiles: profileData as Profile });

                // Fetch quiz
                const { data: quizData, error: quizError } = await supabase
                    .from('quizzes')
                    .select('*')
                    .eq('id', submissionData.quiz_id)
                    .single();
                
                if (quizError) throw quizError;
                setQuiz(quizData as Quiz);

                // Fetch questions
                const { data: questionsData, error: questionsError } = await supabase
                    .from('quiz_questions')
                    .select('*')
                    .eq('quiz_id', submissionData.quiz_id)
                    .order('created_at');
                
                if (questionsError) throw questionsError;
                setQuestions(questionsData as QuizQuestion[]);
            } catch (err: any) {
                console.error("Error fetching submission detail:", err);
                setError(err.message || "An unexpected error occurred.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [submissionId]);

    if (loading) return <div className="p-8 text-center">Loading submission details...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!submission || !quiz) return <div className="p-8 text-center">Submission not found.</div>;

    const answers = Array.isArray(submission.answers) ? (submission.answers as unknown as QuizAnswer[]) : [];

    const getQuestionAnswer = (questionId: string) => {
        return answers.find(a => a?.question_id === questionId);
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-3xl">
            <BackButton to={`/batch/${batchId}/quiz`} text="Back to Quizzes" />
            
            <Card className="mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">{quiz.title}</h1>
                        <p className="text-gray-600 dark:text-gray-400">Participant: <span className="font-semibold">{submission.profiles?.name}</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Score</p>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{submission.score} / {questions.length}</p>
                    </div>
                </div>
            </Card>

            <div className="space-y-6">
                {questions.map((q, index) => {
                    const userAnswer = getQuestionAnswer(q.id);
                    const isCorrect = userAnswer?.selected_option_id === q.correct_option_id;
                    const options = Array.isArray(q.options) ? (q.options as unknown as QuizOption[]) : [];

                    return (
                        <Card key={q.id} className={`border-l-4 ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-semibold">{index + 1}. {q.question_text}</h3>
                                {isCorrect ? (
                                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">Correct</span>
                                ) : (
                                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">Incorrect</span>
                                )}
                            </div>

                            <div className="space-y-2">
                                {options.length > 0 ? options.map(opt => {
                                    const isSelected = userAnswer?.selected_option_id === opt.id;
                                    const isCorrectOpt = q.correct_option_id === opt.id;
                                    
                                    let bgColor = '';
                                    let textColor = '';
                                    if (isSelected && isCorrectOpt) {
                                        bgColor = 'bg-green-50 dark:bg-green-900/20';
                                        textColor = 'text-green-700 dark:text-green-300 font-semibold';
                                    } else if (isSelected && !isCorrectOpt) {
                                        bgColor = 'bg-red-50 dark:bg-red-900/20';
                                        textColor = 'text-red-700 dark:text-red-300 font-semibold';
                                    } else if (!isSelected && isCorrectOpt) {
                                        bgColor = 'bg-green-50/50 dark:bg-green-900/10';
                                        textColor = 'text-green-600 dark:text-green-400';
                                    }

                                    return (
                                        <div 
                                            key={opt.id} 
                                            className={`p-3 rounded-md border ${bgColor || 'border-gray-100 dark:border-gray-700'} ${textColor}`}
                                        >
                                            <div className="flex items-center">
                                                <div className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                                                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                </div>
                                                <span>{opt.text}</span>
                                                {isCorrectOpt && <span className="ml-auto text-xs uppercase tracking-wider font-bold text-green-600">Correct Answer</span>}
                                            </div>
                                        </div>
                                    );
                                }) : <p className="text-sm text-gray-500 italic">No options available for this question.</p>}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
