import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../supabaseClient';
import { Profile, QuizOption, Json } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { TablesInsert } from '../../database.types';

interface CreateQuizProps {
    currentUser: Profile;
}

interface TempQuestion {
    id: string;
    text: string;
    options: QuizOption[];
    correctOptionId: string | null;
}

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-gray-500 hover:text-red-500"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h-4"></path></svg>
);

export const CreateQuiz: React.FC<CreateQuizProps> = ({ currentUser }) => {
    const { batchId } = useParams<{ batchId: string }>();
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState<TempQuestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addQuestion = () => {
        const newOptionId = uuidv4();
        setQuestions([...questions, {
            id: uuidv4(),
            text: '',
            options: [{ id: newOptionId, text: '' }],
            correctOptionId: newOptionId
        }]);
    };
    
    const removeQuestion = (id: string) => setQuestions(questions.filter(q => q.id !== id));

    const updateQuestionText = (id: string, text: string) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, text } : q));
    };

    const addOption = (questionId: string) => {
        setQuestions(questions.map(q => q.id === questionId ? { ...q, options: [...q.options, { id: uuidv4(), text: '' }] } : q));
    };
    
    const removeOption = (questionId: string, optionId: string) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                const newOptions = q.options.filter(opt => opt.id !== optionId);
                // If the removed option was the correct one, reset correctOptionId
                const newCorrectId = q.correctOptionId === optionId ? (newOptions[0]?.id || null) : q.correctOptionId;
                return { ...q, options: newOptions, correctOptionId: newCorrectId };
            }
            return q;
        }));
    };

    const updateOptionText = (questionId: string, optionId: string, text: string) => {
        setQuestions(questions.map(q => q.id === questionId ? {
            ...q,
            options: q.options.map(opt => opt.id === optionId ? { ...opt, text } : opt)
        } : q));
    };

    const setCorrectOption = (questionId: string, optionId: string) => {
        setQuestions(questions.map(q => q.id === questionId ? { ...q, correctOptionId: optionId } : q));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) { setError("Quiz title cannot be empty."); return; }
        if (questions.length === 0) { setError("Please add at least one question."); return; }
        for (const q of questions) {
            if (!q.text.trim()) { setError(`Question "${q.text}" cannot be empty.`); return; }
            if (q.options.length < 2) { setError(`Question "${q.text}" must have at least two options.`); return; }
            if (!q.correctOptionId) { setError(`Please select a correct answer for question "${q.text}".`); return; }
            for (const opt of q.options) {
                if (!opt.text.trim()) { setError(`An option in question "${q.text}" cannot be empty.`); return; }
            }
        }

        setLoading(true);
        
        // FIX: Supabase insert expects an array of objects.
        const { data: quizData, error: quizError } = await supabase
            .from('quizzes')
            .insert([{ title, created_by: currentUser.id, batch_id: batchId! }])
            .select()
            .single();

        if (quizError || !quizData) {
            setError(`Failed to create quiz: ${quizError?.message}`);
            setLoading(false);
            return;
        }

        const questionsToInsert: TablesInsert<'quiz_questions'>[] = questions.map(q => ({
            quiz_id: quizData.id,
            question_text: q.text,
            // FIX: Cast 'options' to 'unknown' then 'Json' to match the Supabase table type.
            options: q.options as unknown as Json,
            correct_option_id: q.correctOptionId!
        }));
        
        const { error: questionsError } = await supabase
            .from('quiz_questions')
            .insert(questionsToInsert);

        if (questionsError) {
            setError(`Quiz created, but failed to add questions: ${questionsError.message}`);
        } else {
            navigate(`/batch/${batchId}/quiz`);
        }
        setLoading(false);
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <BackButton to={`/batch/${batchId}/quiz`} text="Back to Quiz Dashboard" />
            <form onSubmit={handleSubmit}>
                <Card>
                    <h1 className="text-3xl font-bold mb-6">Create New Quiz</h1>
                    <div className="mb-6">
                        <label htmlFor="quizTitle" className="block text-sm font-medium">Quiz Title</label>
                        <input id="quizTitle" type="text" value={title} onChange={e => setTitle(e.target.value)} className="input mt-1" required />
                    </div>

                    <div className="space-y-6">
                        {questions.map((q, qIndex) => (
                            <div key={q.id} className="p-4 border rounded-lg dark:border-gray-700">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="font-semibold">Question {qIndex + 1}</label>
                                    <button type="button" onClick={() => removeQuestion(q.id)}><TrashIcon /></button>
                                </div>
                                <textarea value={q.text} onChange={e => updateQuestionText(q.id, e.target.value)} className="input w-full" rows={2} required />
                                <div className="mt-4 space-y-2">
                                    {q.options.map((opt) => (
                                        <div key={opt.id} className="flex items-center space-x-2">
                                            <input type="radio" name={`correct-opt-${q.id}`} checked={q.correctOptionId === opt.id} onChange={() => setCorrectOption(q.id, opt.id)} />
                                            <input type="text" value={opt.text} onChange={e => updateOptionText(q.id, opt.id, e.target.value)} className="input flex-grow" required />
                                            {q.options.length > 1 && <button type="button" onClick={() => removeOption(q.id, opt.id)}><TrashIcon /></button>}
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" variant="secondary" onClick={() => addOption(q.id)} className="mt-2 text-sm py-1 px-2">Add Option</Button>
                            </div>
                        ))}
                    </div>
                    
                    <Button type="button" onClick={addQuestion} className="mt-6 w-full">Add Question</Button>
                    
                    {error && <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

                    <div className="mt-8 flex justify-end">
                        <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Quiz'}</Button>
                    </div>
                </Card>
            </form>
            <style>{`.input { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; padding: 0.5rem 0.75rem; } .dark .input { background-color: #374151; border-color: #4B5563; }`}</style>
        </div>
    );
};
