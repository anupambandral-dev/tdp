import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { SessionWithAttendance, SessionAttendance, BatchParticipantWithProfile, SessionFile } from '../../types';
import { usePersistentState } from '../../hooks/usePersistentState';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PlusIcon, TrashIcon, EditIcon, FileIcon, LinkIcon, XIcon } from 'lucide-react';

interface Level1ManagerViewProps {
    batchId: string;
    participants: BatchParticipantWithProfile[];
}

export const Level1ManagerView: React.FC<Level1ManagerViewProps> = ({ batchId, participants }) => {
    const [sessions, setSessions] = useState<SessionWithAttendance[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSession, setEditingSession] = useState<SessionWithAttendance | null>(null);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    useEffect(() => {
        fetchSessions();
    }, [batchId]);

    const fetchSessions = async () => {
        setLoading(true);
        const { data, error } = await (supabase
            .from('sessions' as any)
            .select('*, session_attendance(*)')
            .eq('batch_id', batchId)
            .order('session_date', { ascending: false }) as any);

        if (error) {
            console.error(error.message);
        } else {
            setSessions(data as SessionWithAttendance[]);
            if (data.length > 0 && !activeSessionId) {
                setActiveSessionId(data[0].id);
            }
        }
        setLoading(false);
    };

    const handleDeleteSession = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this session?')) return;
        const { error } = await (supabase.from('sessions' as any).delete().eq('id', id) as any);
        if (error) {
            alert(error.message);
        } else {
            setSessions(sessions.filter(s => s.id !== id));
            if (activeSessionId === id) setActiveSessionId(null);
        }
    };

    const activeSession = sessions.find(s => s.id === activeSessionId);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Sessions</h2>
                <Button onClick={() => { setEditingSession(null); setIsModalOpen(true); }}>
                    <PlusIcon className="w-4 h-4 mr-2" /> Add Session
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Session List */}
                <div className="lg:col-span-1 space-y-2">
                    {sessions.length === 0 && !loading && (
                        <p className="text-gray-500 text-sm italic">No sessions added yet.</p>
                    )}
                    {sessions.map(session => (
                        <div 
                            key={session.id}
                            onClick={() => setActiveSessionId(session.id)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                                activeSessionId === session.id 
                                ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                                : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium text-sm">{session.name}</h4>
                                    <p className="text-xs text-gray-500">{session.session_date}</p>
                                </div>
                                <div className="flex space-x-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setEditingSession(session); setIsModalOpen(true); }}
                                        className="p-1 hover:text-blue-600"
                                    >
                                        <EditIcon className="w-3 h-3" />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                        className="p-1 hover:text-red-600"
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Session Details & Attendance */}
                <div className="lg:col-span-3">
                    {activeSession ? (
                        <SessionDetailView 
                            session={activeSession} 
                            participants={participants} 
                            onUpdate={fetchSessions}
                        />
                    ) : (
                        <Card className="flex items-center justify-center py-20 text-gray-500">
                            Select a session to view details and attendance
                        </Card>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <SessionModal 
                    batchId={batchId}
                    session={editingSession}
                    onClose={() => setIsModalOpen(false)}
                    onSave={() => { setIsModalOpen(false); fetchSessions(); }}
                />
            )}
        </div>
    );
};

const SessionDetailView: React.FC<{ 
    session: SessionWithAttendance; 
    participants: BatchParticipantWithProfile[];
    onUpdate: () => void;
}> = ({ session, participants, onUpdate }) => {
    const storageKey = `session-attendance-draft-${session.id}`;
    const [activeTab, setActiveTab] = useState<'attendance' | 'files' | 'pst'>('attendance');
    const [attendanceData, setAttendanceData] = usePersistentState<Record<string, Partial<SessionAttendance>>>(storageKey, () => {
        const initial: Record<string, Partial<SessionAttendance>> = {};
        participants.forEach(p => {
            const existing = session.session_attendance.find(a => a.participant_id === p.participant_id);
            if (existing) {
                initial[p.participant_id] = existing;
            } else {
                initial[p.participant_id] = {
                    session_id: session.id,
                    participant_id: p.participant_id,
                    is_present: false,
                    session_score: 0,
                    pst_score: 0,
                    comments: ''
                };
            }
        });
        return initial;
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Only reset if we don't have saved data for THIS session
        const saved = localStorage.getItem(storageKey);
        if (!saved) {
            const initial: Record<string, Partial<SessionAttendance>> = {};
            participants.forEach(p => {
                const existing = session.session_attendance.find(a => a.participant_id === p.participant_id);
                if (existing) {
                    initial[p.participant_id] = existing;
                } else {
                    initial[p.participant_id] = {
                        session_id: session.id,
                        participant_id: p.participant_id,
                        is_present: false,
                        session_score: 0,
                        pst_score: 0,
                        comments: ''
                    };
                }
            });
            setAttendanceData(initial);
        }
    }, [session, participants, storageKey]);

    const handleAttendanceChange = (participantId: string, field: keyof SessionAttendance, value: any) => {
        setAttendanceData(prev => ({
            ...prev,
            [participantId]: { ...prev[participantId], [field]: value }
        }));
    };

    const saveAttendance = async () => {
        setSaving(true);
        const upserts = Object.values(attendanceData).map(a => ({
            ...a,
            session_id: session.id
        }));

        const { error } = await (supabase
            .from('session_attendance' as any)
            .upsert(upserts, { onConflict: 'session_id,participant_id' }) as any);

        if (error) {
            alert(error.message);
        } else {
            // Clear local storage after successful save
            localStorage.removeItem(storageKey);
            onUpdate();
        }
        setSaving(false);
    };

    return (
        <Card className="p-0 overflow-hidden">
            <div className="p-6 border-b dark:border-gray-700">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold">{session.name}</h3>
                        <p className="text-sm text-gray-500">{session.session_date} | {session.start_time} - {session.end_time}</p>
                    </div>
                    <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                            new Date(session.session_date) < new Date() ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-600'
                        }`}>
                            {new Date(session.session_date) < new Date() ? 'Past' : 'Upcoming'}
                        </span>
                    </div>
                </div>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{session.details || 'No details provided.'}</p>
            </div>

            <div className="flex border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button 
                    onClick={() => setActiveTab('attendance')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'attendance' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Attendance & Scores
                </button>
                <button 
                    onClick={() => setActiveTab('files')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'files' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Files & Links
                </button>
                <button 
                    onClick={() => setActiveTab('pst')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pst' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Post Session Task (PST)
                </button>
            </div>

            <div className="p-6">
                {activeTab === 'attendance' && (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Participant</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Present</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Session Score</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">PST Score</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Comments</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {participants.map(p => {
                                        const att = attendanceData[p.participant_id] || {};
                                        return (
                                            <tr key={p.participant_id}>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{p.profiles?.name}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={att.is_present || false}
                                                        onChange={(e) => handleAttendanceChange(p.participant_id, 'is_present', e.target.checked)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <input 
                                                        type="number" 
                                                        value={att.session_score || 0}
                                                        onChange={(e) => handleAttendanceChange(p.participant_id, 'session_score', parseFloat(e.target.value))}
                                                        className="w-16 p-1 text-sm border rounded text-center"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <input 
                                                        type="number" 
                                                        value={att.pst_score || 0}
                                                        onChange={(e) => handleAttendanceChange(p.participant_id, 'pst_score', parseFloat(e.target.value))}
                                                        className="w-16 p-1 text-sm border rounded text-center"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <input 
                                                        type="text" 
                                                        value={att.comments || ''}
                                                        onChange={(e) => handleAttendanceChange(p.participant_id, 'comments', e.target.value)}
                                                        placeholder="Add comment..."
                                                        className="w-full p-1 text-sm border rounded"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button onClick={saveAttendance} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Attendance & Scores'}
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'files' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {session.files && session.files.length > 0 ? (
                                session.files.map((file, idx) => (
                                    <div key={idx} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                        {file.type === 'file' ? <FileIcon className="w-5 h-5 text-blue-500 mr-3" /> : <LinkIcon className="w-5 h-5 text-green-500 mr-3" />}
                                        <div className="flex-grow overflow-hidden">
                                            <p className="text-sm font-medium truncate">{file.name}</p>
                                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                                                {file.url}
                                            </a>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-sm italic col-span-2">No files or links added to this session.</p>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-4 italic">Note: Files and links can be managed by editing the session details.</p>
                    </div>
                )}

                {activeTab === 'pst' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg">
                            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 uppercase tracking-wider">Task Description</h4>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                {session.pst_details || 'No post-session task details provided.'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};

const SessionModal: React.FC<{
    batchId: string;
    session: SessionWithAttendance | null;
    onClose: () => void;
    onSave: () => void;
}> = ({ batchId, session, onClose, onSave }) => {
    const storageKey = `session-modal-draft-${batchId}-${session?.id || 'new'}`;
    const [formData, setFormData] = usePersistentState(`${storageKey}`, {
        name: session?.name || '',
        details: session?.details || '',
        session_date: session?.session_date || new Date().toISOString().split('T')[0],
        start_time: session?.start_time || '09:00',
        end_time: session?.end_time || '10:00',
        pst_details: session?.pst_details || '',
        files: (session?.files || []) as SessionFile[]
    });
    const [loading, setLoading] = useState(false);

    const handleAddFile = () => {
        setFormData(prev => ({
            ...prev,
            files: [...prev.files, { name: '', url: '', type: 'link' }]
        }));
    };

    const handleRemoveFile = (idx: number) => {
        setFormData(prev => ({
            ...prev,
            files: prev.files.filter((_, i) => i !== idx)
        }));
    };

    const handleFileChange = (idx: number, field: keyof SessionFile, value: string) => {
        const newFiles = [...formData.files];
        newFiles[idx] = { ...newFiles[idx], [field]: value };
        setFormData(prev => ({ ...prev, files: newFiles }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            ...formData,
            batch_id: batchId,
            files: formData.files as any
        };

        let error;
        if (session) {
            const { error: err } = await (supabase.from('sessions' as any).update(payload).eq('id', session.id) as any);
            error = err;
        } else {
            const { error: err } = await (supabase.from('sessions' as any).insert([payload]) as any);
            error = err;
        }

        if (error) {
            alert(error.message);
        } else {
            // Clear local storage after successful save
            localStorage.removeItem(storageKey);
            onSave();
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{session ? 'Edit Session' : 'Add New Session'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><XIcon className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Session Name</label>
                        <input 
                            type="text" 
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                            placeholder="e.g. Introduction to Prior Art"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Date</label>
                            <input 
                                type="date" 
                                required
                                value={formData.session_date}
                                onChange={e => setFormData({ ...formData, session_date: e.target.value })}
                                className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Start Time</label>
                            <input 
                                type="time" 
                                required
                                value={formData.start_time}
                                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">End Time</label>
                            <input 
                                type="time" 
                                required
                                value={formData.end_time}
                                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Session Details</label>
                        <textarea 
                            value={formData.details}
                            onChange={e => setFormData({ ...formData, details: e.target.value })}
                            className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                            rows={3}
                            placeholder="What will be covered in this session?"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Post Session Task (PST)</label>
                        <textarea 
                            value={formData.pst_details}
                            onChange={e => setFormData({ ...formData, pst_details: e.target.value })}
                            className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                            rows={3}
                            placeholder="Describe the task trainees need to complete after this session."
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium">Files & Links</label>
                            <Button type="button" variant="secondary" onClick={handleAddFile} className="text-xs py-1 px-2">
                                <PlusIcon className="w-3 h-3 mr-1" /> Add File/Link
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {formData.files.map((file, idx) => (
                                <div key={idx} className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                                    <select 
                                        value={file.type}
                                        onChange={e => handleFileChange(idx, 'type', e.target.value as any)}
                                        className="text-xs p-1 border rounded"
                                    >
                                        <option value="link">Link</option>
                                        <option value="file">File URL</option>
                                    </select>
                                    <input 
                                        type="text" 
                                        value={file.name}
                                        onChange={e => handleFileChange(idx, 'name', e.target.value)}
                                        placeholder="Name"
                                        className="text-xs p-1 border rounded flex-grow"
                                    />
                                    <input 
                                        type="text" 
                                        value={file.url}
                                        onChange={e => handleFileChange(idx, 'url', e.target.value)}
                                        placeholder="URL"
                                        className="text-xs p-1 border rounded flex-grow"
                                    />
                                    <button type="button" onClick={() => handleRemoveFile(idx)} className="text-red-500 hover:text-red-700">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-6 border-t dark:border-gray-700">
                        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Session'}</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
