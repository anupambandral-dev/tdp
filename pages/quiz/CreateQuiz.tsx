import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../supabaseClient';
import { Profile, QuizOption, Json } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { TablesInsert } from '../../database.types';
import { usePersistentState } from '../../hooks/usePersistentState';

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
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h-4"></path></svg>
);

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

export const CreateQuiz: React.FC<CreateQuizProps> = ({ currentUser }) => {
    const { batchId } = useParams<{ batchId: string }>();
    const navigate = useNavigate();
    
    const storageKey = `create-quiz-draft-${batchId}-${currentUser?.id || 'anon'}`;

    const [activeTab, setActiveTab] = useState<'general' | 'questions'>('general');
    
    const [title, setTitle] = usePersistentState<string>(`${storageKey}-title`, '');
    const [questions, setQuestions] = usePersistentState<TempQuestion[]>(`${storageKey}-questions`, []);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');

    // Show saving status when title or questions change
    const prevTitle = React.useRef(title);
    const prevQuestions = React.useRef(questions);

    useEffect(() => {
        if (prevTitle.current !== title || prevQuestions.current !== questions) {
            setSaveStatus('saving');
            const timeout = setTimeout(() => {
                setSaveStatus('saved');
                const statusTimeout = setTimeout(() => setSaveStatus('idle'), 2000);
                return () => clearTimeout(statusTimeout);
            }, 500);
            prevTitle.current = title;
            prevQuestions.current = questions;
            return () => clearTimeout(timeout);
        }
    }, [title, questions]);

    const clearDraft = () => {
        localStorage.removeItem(`${storageKey}-title`);
        localStorage.removeItem(`${storageKey}-questions`);
    };

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
            clearDraft();
            navigate(`/batch/${batchId}/quiz`);
        }
        setLoading(false);
    };

    const inputClasses = "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2";

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <BackButton to={`/batch/${batchId}/quiz`} text="Back to Quiz Dashboard" />
            <form onSubmit={handleSubmit}>
                <Card>
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold">Create New Quiz</h1>
                        <div className="text-xs text-gray-400 flex items-center">
                            {saveStatus === 'saving' && <span className="animate-pulse">Saving draft...</span>}
                            {saveStatus === 'saved' && <span className="text-green-500 flex items-center"><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Draft saved</span>}
                        </div>
                    </div>
                    
                    <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            <button
                                type="button"
                                onClick={() => setActiveTab('general')}
                                className={`${activeTab === 'general' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                General Info
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('questions')}
                                className={`${activeTab === 'questions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Questions ({questions.length})
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'general' && (
                        <div className="mb-6 animate-in fade-in duration-300">
                            <label htmlFor="quizTitle" className="block text-sm font-medium">Quiz Title</label>
                            <input 
                                id="quizTitle" 
                                type="text" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                className={`${inputClasses} mt-1`} 
                                placeholder="Enter quiz title..."
                                required 
                            />
                            <div className="mt-8 flex justify-end">
                                <Button type="button" onClick={() => setActiveTab('questions')}>Next: Add Questions</Button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'questions' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="space-y-6">
                                {questions.map((q, qIndex) => (
                                    <div key={q.id} className="p-4 border rounded-lg dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="font-semibold">Question {qIndex + 1}</label>
                                            <button type="button" onClick={() => removeQuestion(q.id)} className="p-1 hover:bg-red-100 rounded transition-colors"><TrashIcon /></button>
                                        </div>
                                        <textarea 
                                            value={q.text} 
                                            onChange={e => updateQuestionText(q.id, e.target.value)} 
                                            className={`${inputClasses} w-full`} 
                                            rows={2} 
                                            placeholder="Enter question text..."
                                            required 
                                        />
                                        <div className="mt-4 space-y-2">
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Options (Select the correct one)</label>
                                            {q.options.map((opt) => (
                                                <div key={opt.id} className="flex items-center space-x-2">
                                                    <input 
                                                        type="radio" 
                                                        name={`correct-opt-${q.id}`} 
                                                        checked={q.correctOptionId === opt.id} 
                                                        onChange={() => setCorrectOption(q.id, opt.id)} 
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={opt.text} 
                                                        onChange={e => updateOptionText(q.id, opt.id, e.target.value)} 
                                                        className={`${inputClasses} flex-grow`} 
                                                        placeholder="Option text..."
                                                        required 
                                                    />
                                                    {q.options.length > 1 && (
                                                        <button type="button" onClick={() => removeOption(q.id, opt.id)} className="p-1 hover:bg-red-100 rounded transition-colors"><TrashIcon /></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <Button type="button" variant="secondary" onClick={() => addOption(q.id)} className="mt-2 text-xs py-1 px-3">Add Option</Button>
                                    </div>
                                ))}
                            </div>
                            
                            <Button type="button" variant="secondary" onClick={addQuestion} className="mt-4 w-full border-dashed border-2">
                                <span className="flex items-center justify-center"><PlusIcon /> Add Question</span>
                            </Button>
                            
                            {error && <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}

                            <div className="mt-8 flex justify-between items-center border-t pt-6 dark:border-gray-700">
                                <Button type="button" variant="secondary" onClick={() => setActiveTab('general')}>Back to General</Button>
                                <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Quiz'}</Button>
                            </div>
                        </div>
                    )}
                </Card>
            </form>
        </div>
    );
};
