import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  currentUser: Profile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for an existing session on initial load.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Manually trigger the profile fetch for the initial session
      if (session) {
        fetchProfile(session);
      } else {
        setLoading(false);
      }
    });

    // Listen for changes in authentication state (login, logout).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          fetchProfile(session);
        } else {
          setCurrentUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (currentSession: Session) => {
    if (currentSession?.user) {
      setLoading(true);
      const { data, error } = await supabase.rpc('link_auth_to_profile');
      
      if (error) {
        console.error("Error fetching/linking profile:", error);
        await supabase.auth.signOut();
        setCurrentUser(null);
      } else if (data && data.length > 0) {
        setCurrentUser(data[0] as Profile);
      } else {
        console.error("Authenticated user has no profile, signing out.");
        await supabase.auth.signOut();
        setCurrentUser(null);
      }
      setLoading(false);
    }
  };
  
  const value = {
    session,
    currentUser,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};