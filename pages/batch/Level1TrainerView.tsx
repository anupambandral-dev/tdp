import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Profile, SessionWithAttendance } from '../../types';
import { Card } from '../../components/ui/Card';
import { FileIcon, LinkIcon, CalendarIcon, ClockIcon } from 'lucide-react';

interface Level1TraineeViewProps {
    batchId: string;
    currentUser: Profile;
}

export const Level1TraineeView: React.FC<Level1TraineeViewProps> = ({ batchId, currentUser }) => {
    const [sessions, setSessions] = useState<SessionWithAttendance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
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
            setError(error.message);
        } else {
            setSessions(data as SessionWithAttendance[]);
            if (data.length > 0) {
                setActiveSessionId(data[0].id);
            }
        }
        setLoading(false);
    };

    const activeSession = sessions.find(s => s.id === activeSessionId);
    const myAttendance = activeSession?.session_attendance.find(a => a.participant_id === currentUser.id);

    if (loading) return <div className="py-10 text-center">Loading sessions...</div>;
    if (error) return <div className="py-10 text-center text-red-500">Error: {error}</div>;
    if (sessions.length === 0) return (
        <Card className="py-20 text-center text-gray-500 italic">
            No training sessions have been scheduled yet.
        </Card>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Session List */}
            <div className="lg:col-span-1 space-y-2">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">All Sessions</h3>
                {sessions.map(session => (
                    <div 
                        key={session.id}
                        onClick={() => setActiveSessionId(session.id)}
                        className={`p-4 rounded-xl cursor-pointer transition-all border ${
                            activeSessionId === session.id 
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm' 
                            : 'bg-white border-gray-100 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700'
                        }`}
                    >
                        <h4 className="font-semibold text-sm mb-1">{session.name}</h4>
                        <div className="flex items-center text-xs text-gray-500 space-x-2">
                            <CalendarIcon className="w-3 h-3" />
                            <span>{session.session_date}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Session Details */}
            <div className="lg:col-span-3 space-y-6">
                {activeSession && (
                    <>
                        <Card className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">{activeSession.name}</h2>
                                    <div className="flex items-center text-gray-500 space-x-4">
                                        <div className="flex items-center text-sm">
                                            <CalendarIcon className="w-4 h-4 mr-1" />
                                            {activeSession.session_date}
                                        </div>
                                        <div className="flex items-center text-sm">
                                            <ClockIcon className="w-4 h-4 mr-1" />
                                            {activeSession.start_time} - {activeSession.end_time}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                        myAttendance?.is_present 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                        {myAttendance?.is_present ? 'Present' : 'Absent'}
                                    </div>
                                </div>
                            </div>

                            <div className="prose prose-sm dark:prose-invert max-w-none mb-8">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Details</h4>
                                <p>{activeSession.details || 'No details provided.'}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Files & Resources</h4>
                                    <div className="space-y-3">
                                        {activeSession.files && activeSession.files.length > 0 ? (
                                            activeSession.files.map((file, idx) => (
                                                <a 
                                                    key={idx} 
                                                    href={file.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-blue-300 transition-colors group"
                                                >
                                                    {file.type === 'file' ? <FileIcon className="w-5 h-5 text-blue-500 mr-3" /> : <LinkIcon className="w-5 h-5 text-green-500 mr-3" />}
                                                    <div className="flex-grow overflow-hidden">
                                                        <p className="text-sm font-medium truncate group-hover:text-blue-600">{file.name}</p>
                                                        <p className="text-xs text-gray-400 truncate">{file.url}</p>
                                                    </div>
                                                </a>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">No resources shared for this session.</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Post Session Task (PST)</h4>
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl">
                                        <p className="text-sm text-blue-900 dark:text-blue-200 whitespace-pre-wrap">
                                            {activeSession.pst_details || 'No task assigned for this session.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Performance Summary */}
                        <Card className="p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                            <h3 className="text-lg font-bold mb-4">Your Performance</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Session Score</p>
                                    <p className="text-2xl font-black text-blue-600">{myAttendance?.session_score || 0}</p>
                                </div>
                                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">PST Score</p>
                                    <p className="text-2xl font-black text-green-600">{myAttendance?.pst_score || 0}</p>
                                </div>
                                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 md:col-span-2">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Manager Comments</p>
                                    <p className="text-sm italic text-gray-600 dark:text-gray-400">
                                        {myAttendance?.comments || 'No comments yet.'}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
};
