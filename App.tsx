


import React, { useState, useMemo, useCallback, useEffect, createContext } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from './services/supabase';
import type { AppContextType, Workshop, CurrentUser, SessionWithRecords, Employee, SessionParticipantRecord, Host, Database } from './types';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import JoinSessionPage from './pages/JoinSessionPage';
import LiveSessionPage from './pages/LiveSessionPage';
import WorkshopDetailPage from './pages/WorkshopDetailPage';
import SessionDetailPage from './pages/SessionDetailPage';
import EmployeesPage from './pages/EmployeesPage';
import HostWorkshopLoginPage from './pages/HostWorkshopLoginPage';
import HostWorkshopDashboardPage from './pages/HostWorkshopDashboardPage';
import HostLayout from './layouts/HostLayout';
import { LogoIcon } from './components/Icons';

export const AppContext = createContext<AppContextType | null>(null);

const AppContent: React.FC = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error("AppContext not found");
    const { currentUser, logout } = context;
    const location = useLocation();

    const isPublicPage = location.pathname.startsWith('/session/') || location.pathname.startsWith('/host/');
    const isManager = currentUser?.role === 'manager';

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
            <header className="bg-white shadow-sm">
                <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <Link to={currentUser ? "/dashboard" : "/login"} className="flex items-center space-x-3 cursor-pointer group" aria-label="Go to dashboard">
                            <LogoIcon className="h-8 w-auto text-primary transition-transform group-hover:rotate-12" />
                            <span className="text-xl font-bold text-gray-800 hidden sm:block">Workshop Platform</span>
                        </Link>
                        {currentUser && !isPublicPage && (
                             <div className="flex items-center space-x-4">
                                {isManager && (
                                    <Link to="/employees" className="text-sm font-medium text-gray-700 hover:text-primary">
                                        Manage Employees
                                    </Link>
                                )}
                                <button
                                    onClick={logout}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </nav>
            </header>
            <main>
                <Routes>
                    {/* Manager Routes */}
                    <Route path="/login" element={currentUser && currentUser.role === 'manager' ? <Navigate to="/dashboard" /> : <LoginPage />} />
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                    <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
                    <Route path="/workshop/:workshopId" element={<ProtectedRoute><WorkshopDetailPage /></ProtectedRoute>} />
                    
                    {/* Host-specific Routes wrapped in a security layout */}
                    <Route path="/host/workshop/:workshopId" element={<HostLayout />}>
                        <Route path="dashboard" element={<HostWorkshopDashboardPage />} />
                    </Route>

                    {/* Shared manager/host route */}
                    <Route path="/workshop/:workshopId/session/:sessionId" element={<SessionDetailPage />} />

                    {/* Public Routes for Hosts & Participants */}
                    <Route path="/host/workshop/:workshopId/login" element={<HostWorkshopLoginPage />} />
                    <Route path="/session/:sessionId/join" element={<JoinSessionPage />} />
                    <Route path="/session/:sessionId/live" element={<LiveSessionPage />} />

                    {/* Default Route */}
                    <Route path="*" element={<Navigate to={currentUser ? "/dashboard" : "/login"} />} />
                </Routes>
            </main>
        </div>
    );
}

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error("AppContext not found");
    const { currentUser, isLoading } = context;

    if (isLoading) return <div className="p-10 text-center">Loading user session...</div>;
    if (!currentUser || currentUser.role !== 'manager') {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};


const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [allWorkshops, setAllWorkshops] = useState<Workshop[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);

        // Fetch employees separately for other parts of the app like modals and the employee page.
        // This query is still subject to RLS, which is appropriate for its usage.
        const { data: employeesData, error: employeesError } = await supabase
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (employeesError) {
            console.error('Error fetching employees:', employeesError);
        }
        setEmployees(employeesData || []);

        // Use the new Edge Function to get all workshop data. This securely bypasses RLS
        // to ensure that joined data like host names is always included.
        const { data: workshopData, error: functionError } = await supabase.functions.invoke('get-workshop-details');

        if (functionError) {
            console.error('Error fetching workshops via function:', functionError);
            setAllWorkshops([]);
        } else if (workshopData?.workshops) {
             const enrichedWorkshops = workshopData.workshops.map((ws: any) => ({
                ...ws,
                hosts: (Array.isArray(ws.hosts) ? ws.hosts : []).map((host: any) => ({
                    employee_id: host.employee_id,
                    name: host.employees?.name || 'Unknown Host',
                    email: host.employees?.email || host.email || 'No email',
                })),
                participants: (Array.isArray(ws.participants) ? ws.participants : []).map((p: any) => ({
                    id: p.id, workshop_id: p.workshop_id, employee_id: p.employee_id,
                    name: p.employees?.name || p.name || 'Unknown Participant', 
                    email: p.employees?.email || p.email || 'No email'
                })),
                sessions: (Array.isArray(ws.sessions) ? ws.sessions : []).map((session: any) => ({
                    ...session,
                    session_participant_records: session.session_participant_records || [],
                })),
            }));
            setAllWorkshops(enrichedWorkshops as unknown as Workshop[]);
        } else {
            setAllWorkshops([]);
        }

        setIsLoading(false);
    }, []);
    
    // This effect now only handles the initial data load.
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);
    
    // This effect handles the manager's auth session. Host session is handled in HostLayout.
    useEffect(() => {
        setIsLoading(true);
        supabase.auth.getSession().then(({ data: { session } }) => {
             if (session?.user) {
                const user: CurrentUser = {
                    id: session.user.id, name: session.user.email?.split('@')[0] || 'User',
                    email: session.user.email!, role: 'manager',
                };
                setCurrentUser(user);
            } else {
                setCurrentUser(null);
            }
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                const user: CurrentUser = {
                    id: session.user.id, name: session.user.email?.split('@')[0] || 'User',
                    email: session.user.email!, role: 'manager',
                };
                setCurrentUser(user);
            } else {
                setCurrentUser(null);
            }
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const logout = useCallback(async () => {
        // Clear both potential sessions for a full logout
        sessionStorage.removeItem('host_session');
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Error signing out:", error);
        setCurrentUser(null);
        // Do not clear all data, as public pages might need it. Let the next auth state handle it.
    }, []);
    
     const addWorkshop = useCallback(async (workshopData: { title: string; total_sessions: number; weekday: string; time: string }, hosts: Employee[], participants: Employee[]) => {
        if (!currentUser || currentUser.role !== 'manager') throw new Error("User must be a manager to create a workshop.");

        const { data: workshop, error: workshopError } = await supabase
            .from('workshops')
            .insert({ title: workshopData.title, manager_id: currentUser.id })
            .select().single();
        if (workshopError || !workshop) throw new Error(workshopError?.message || "Failed to create workshop.");

        const sessionsToCreate: Array<Database['public']['Tables']['sessions']['Insert']> = [];
        let currentDate = new Date();
        const targetWeekday = parseInt(workshopData.weekday, 10);
        while (currentDate.getDay() !== targetWeekday) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        const [hours, minutes] = workshopData.time.split(':').map(Number);
        for (let i = 1; i <= workshopData.total_sessions; i++) {
            currentDate.setHours(hours, minutes, 0, 0);
            const endTime = `${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            sessionsToCreate.push({
                workshop_id: workshop.id, session_number: i, title: `Session ${i}`,
                date: currentDate.toISOString().split('T')[0], start_time: workshopData.time,
                end_time: endTime, status: 'scheduled' as const,
            });
            currentDate.setDate(currentDate.getDate() + 7);
        }
        const { data: sessions, error: sessionsError } = await supabase.from('sessions').insert(sessionsToCreate).select();
        if (sessionsError || !sessions) throw new Error(sessionsError?.message || "Failed to create sessions.");

        const hostsToCreate: Array<Database['public']['Tables']['hosts']['Insert']> = hosts.map(h => ({ workshop_id: workshop.id, employee_id: h.id, email: h.email }));
        const { error: hostsError } = await supabase.from('hosts').insert(hostsToCreate);
        if (hostsError) throw new Error(hostsError.message);

        const participantsToCreate: Array<Database['public']['Tables']['participants']['Insert']> = participants.map(p => ({ workshop_id: workshop.id, employee_id: p.id, name: p.name, email: p.email }));
        const { data: createdParticipants, error: participantsError } = await supabase.from('participants').insert(participantsToCreate).select();
        if (participantsError || !createdParticipants) throw new Error(participantsError?.message || "Failed to create participants.");
        
        const recordsToCreate: Array<Database['public']['Tables']['session_participant_records']['Insert']> = [];
        for (const session of sessions) {
            for (const participant of createdParticipants) {
                recordsToCreate.push({
                    session_id: session.id, participant_id: participant.id, attendance: 'pending' as const
                });
            }
        }
        const { error: recordsError } = await supabase.from('session_participant_records').insert(recordsToCreate);
        if (recordsError) throw new Error(recordsError.message);

        await fetchAllData();
    }, [currentUser, fetchAllData]);
    
    const addEmployees = useCallback(async (newEmployees: { name: string; email: string }[]) => {
        setIsLoading(true);
        try {
            if (newEmployees.length === 0) return { error: null };
            const { error: functionError } = await supabase.functions.invoke('import-employees', {
                body: { users: newEmployees },
            });
            if (functionError) throw functionError;
            await fetchAllData();
            return { error: null };
        } catch (err: any) {
            console.error("Error invoking import-employees function:", err);
            let errorMessage = `Import failed: ${err.message || 'An unknown error occurred.'}`;
            return { error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [fetchAllData]);

    const updateSessionInState = useCallback((updatedSession: SessionWithRecords) => {
        setAllWorkshops(prev => prev.map(ws => {
            if (ws.id === updatedSession.workshop_id) {
                return { ...ws, sessions: ws.sessions.map(s => s.id === updatedSession.id ? updatedSession : s) };
            }
            return ws;
        }));
    }, []);

    const updateSession = useCallback(async (session: SessionWithRecords) => {
        const { session_participant_records, ...sessionData } = session;
        const { id: sessionId, ...sessionUpdateData } = sessionData;
        const { error } = await supabase.from('sessions').update(sessionUpdateData).eq('id', sessionId);
        if (error) throw error;
        for (const record of session_participant_records) {
             const { id: recordId, ...recordUpdateData } = record;
            const { error: recordError } = await supabase.from('session_participant_records').update(recordUpdateData).eq('id', recordId);
            if (recordError) throw recordError;
        }
        updateSessionInState(session);
    }, [updateSessionInState]);

    const deleteWorkshop = useCallback(async (workshopId: string) => {
        const { error } = await supabase.from('workshops').delete().eq('id', workshopId);
        if (error) throw error;
        setAllWorkshops(prev => prev.filter(ws => ws.id !== workshopId));
    }, []);
    
    const updateParticipantRecordInState = useCallback((updatedRecord: SessionParticipantRecord) => {
         setAllWorkshops(prev => prev.map(ws => {
            const sessionToUpdate = ws.sessions.find(s => s.id === updatedRecord.session_id);
            if (sessionToUpdate) {
                return {
                    ...ws,
                    sessions: ws.sessions.map(s => {
                        if (s.id === updatedRecord.session_id) {
                            return { ...s, session_participant_records: s.session_participant_records.map(r => r.id === updatedRecord.id ? updatedRecord : r) };
                        }
                        return s;
                    })
                };
            }
            return ws;
        }));
    }, []);
    
    const addParticipantToWorkshop = useCallback(async (workshopId: string, employee: Employee) => {
        if (!currentUser || currentUser.role !== 'manager') {
            throw new Error("User must be a manager to add participants.");
        }

        const { data: newParticipant, error: participantError } = await supabase
            .from('participants')
            .insert({
                workshop_id: workshopId,
                employee_id: employee.id,
                name: employee.name,
                email: employee.email,
            })
            .select()
            .single();

        if (participantError || !newParticipant) {
            throw new Error(participantError?.message || "Failed to add participant.");
        }

        const workshop = allWorkshops.find(ws => ws.id === workshopId);
        if (!workshop) {
            throw new Error("Workshop not found in current state.");
        }
        const sessions = workshop.sessions;

        if (sessions.length > 0) {
            const recordsToCreate: Array<Database['public']['Tables']['session_participant_records']['Insert']> = sessions.map(session => ({
                session_id: session.id,
                participant_id: newParticipant.id,
                attendance: 'pending' as const
            }));

            const { error: recordsError } = await supabase
                .from('session_participant_records')
                .insert(recordsToCreate);

            if (recordsError) {
                await supabase.from('participants').delete().eq('id', newParticipant.id);
                throw new Error(recordsError.message);
            }
        }
        await fetchAllData();
    }, [currentUser, allWorkshops, fetchAllData]);
    
    const workshopsForManager = useMemo(() => {
        if (currentUser?.role === 'manager') return allWorkshops;
        return [];
    }, [currentUser, allWorkshops]);

    // FIX: Corrected the useMemo hook syntax. The factory function was not properly closed, causing it to be parsed as a comma expression and returning the dependency array instead of the context value object. This fixes both reported errors.
    const value = useMemo(() => ({
        currentUser,
        // Fix: Pass the actual setCurrentUser state setter to the context. This allows components to update the user state.
        setCurrentUser,
        workshops: workshopsForManager, // only for manager dashboard
        allWorkshops, // for public pages
        employees,
        isLoading,
        logout,
        addWorkshop,
        addEmployees,
        updateSession,
        deleteWorkshop,
        updateSessionInState,
        updateParticipantRecordInState,
        addParticipantToWorkshop
        // Fix: Added setCurrentUser to the dependency array.
    }), [currentUser, setCurrentUser, workshopsForManager, allWorkshops, employees, isLoading, logout, addWorkshop, addEmployees, updateSession, deleteWorkshop, updateSessionInState, updateParticipantRecordInState, addParticipantToWorkshop]);

    return (
        <AppContext.Provider value={value}>
            <HashRouter>
                <AppContent />
            </HashRouter>
        </AppContext.Provider>
    );
};

export default App;
