import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../supabaseClient';
import { Profile, QuizOption } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { TablesInsert } from '../../database.types';

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h-4"></path></svg>;

interface CreateQuizProps {
    currentUser: Profile;
}

type EditableQuestion = {
    id: string;
    question_text: string;
    options: QuizOption[];
    correct_option_id: string | null;
};

export const CreateQuiz: React.FC<CreateQuizProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState<EditableQuestion[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addQuestion = () => {
        const newOptionId = uuidv4();
        setQuestions([
            ...questions,
            {
                id: uuidv4(),
                question_text: '',
                options: [{ id: newOptionId, text: '' }],
                correct_option_id: newOptionId,
            },
        ]);
    };

    const removeQuestion = (questionId: string) => {
        setQuestions(questions.filter(q => q.id !== questionId));
    };

    const updateQuestionText = (questionId: string, text: string) => {
        setQuestions(questions.map(q => q.id === questionId ? { ...q, question_text: text } : q));
    };

    const addOption = (questionId: string) => {
        setQuestions(questions.map(q => 
            q.id === questionId 
            ? { ...q, options: [...q.options, { id: uuidv4(), text: '' }] } 
            : q
        ));
    };

    const removeOption = (questionId: string, optionId: string) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                const newOptions = q.options.filter(o => o.id !== optionId);
                // If the removed option was the correct one, reset correct_option_id
                const newCorrectId = q.correct_option_id === optionId ? (newOptions[0]?.id || null) : q.correct_option_id;
                return { ...q, options: newOptions, correct_option_id: newCorrectId };
            }
            return q;
        }));
    };

    const updateOptionText = (questionId: string, optionId: string, text: string) => {
        setQuestions(questions.map(q => 
            q.id === questionId 
            ? { ...q, options: q.options.map(o => o.id === optionId ? { ...o, text } : o) } 
            : q
        ));
    };

    const setCorrectOption = (questionId: string, optionId: string) => {
        setQuestions(questions.map(q => q.id === questionId ? { ...q, correct_option_id: optionId } : q));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError('Quiz title is required.');
            return;
        }
        if (questions.length === 0) {
            setError('Quiz must have at least one question.');
            return;
        }
        for (const q of questions) {
            if (!q.question_text.trim()) {
                setError('All questions must have text.');
                return;
            }
            if (q.options.length < 1) {
                setError(`Question "${q.question_text}" must have at least one option.`);
                return;
            }
            for (const o of q.options) {
                if (!o.text.trim()) {
                    setError(`All options for question "${q.question_text}" must have text.`);
                    return;
                }
            }
            if (!q.correct_option_id) {
                setError(`A correct answer must be selected for question "${q.question_text}".`);
                return;
            }
        }

        setSubmitting(true);

        // 1. Insert the quiz
        const { data: quizData, error: quizError } = await supabase
            .from('quizzes')
            .insert({ title, created_by: currentUser.id } as TablesInsert<'quizzes'>)
            .select()
            .single();

        if (quizError || !quizData) {
            setError(`Error creating quiz: ${quizError?.message}`);
            setSubmitting(false);
            return;
        }

        // 2. Prepare and insert the questions
        const questionsToInsert: TablesInsert<'quiz_questions'>[] = questions.map(q => ({
            quiz_id: quizData.id,
            question_text: q.question_text,
            options: q.options as any, // Cast to any to satisfy Json type
            correct_option_id: q.correct_option_id!,
        }));

        const { error: questionsError } = await supabase.from('quiz_questions').insert(questionsToInsert);

        if (questionsError) {
            setError(`Error saving questions: ${questionsError.message}`);
            // Attempt to clean up the created quiz shell
            await supabase.from('quizzes').delete().eq('id', quizData.id);
        } else {
            navigate('/quiz');
        }

        setSubmitting(false);
    };


    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <BackButton to="/quiz" text="Back to Quiz Dashboard" />
            <Card>
                <h1 className="text-3xl font-bold mb-6">Create New Quiz</h1>
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div>
                        <label htmlFor="title">Quiz Title</label>
                        <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} required className="input" />
                    </div>

                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold">Questions</h2>
                        {questions.map((q, qIndex) => (
                            <div key={q.id} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-4">
                                    <label htmlFor={`q-text-${q.id}`} className="font-semibold">Question {qIndex + 1}</label>
                                    <Button type="button" variant="danger-outline" onClick={() => removeQuestion(q.id)}><TrashIcon /></Button>
                                </div>
                                <textarea id={`q-text-${q.id}`} value={q.question_text} onChange={e => updateQuestionText(q.id, e.target.value)} rows={2} required className="input" />

                                <div className="mt-4 space-y-2">
                                    {q.options.map(o => (
                                        <div key={o.id} className="flex items-center gap-2">
                                            <input type="radio" name={`correct-opt-${q.id}`} checked={q.correct_option_id === o.id} onChange={() => setCorrectOption(q.id, o.id)} />
                                            <input type="text" value={o.text} onChange={e => updateOptionText(q.id, o.id, e.target.value)} required className="input flex-grow" placeholder="Option text" />
                                            {q.options.length > 1 && <Button type="button" variant="secondary" onClick={() => removeOption(q.id, o.id)} className="p-2 h-8 w-8 flex items-center justify-center"><TrashIcon /></Button>}
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" variant="secondary" onClick={() => addOption(q.id)} className="mt-4 text-sm"><PlusIcon /> Add Option</Button>
                            </div>
                        ))}
                        <Button type="button" onClick={addQuestion} className="w-full"><PlusIcon /> Add New Question</Button>
                    </div>

                    {error && <p className="text-red-500">{error}</p>}

                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save Quiz'}
                        </Button>
                    </div>
                </form>
            </Card>
            <style>{`label { display: block; margin-bottom: 0.25rem; font-weight: 500; } .input { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; padding: 0.5rem 0.75rem; } .dark .input { background-color: #374151; border-color: #4B5563; }`}</style>
        </div>
    );
};
