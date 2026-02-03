// context/AuthContext.tsx
// Provider de autenticação com Supabase Auth
// Gerencia: login, registro, logout, estado da sessão

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import type { User } from '@/types';
import type { Session, AuthError } from '@supabase/supabase-js';

interface AuthContextType {
  // Estado
  session: Session | null;
  user: User | null;
  loading: boolean;
  initializing: boolean;

  // Ações
  signUp: (email: string, password: string, nome: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: false,
  initializing: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Buscar perfil do usuário em public.users
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Perfil ainda não existe ou erro:', error.message);
        return null;
      }
      return data as User;
    } catch (e) {
      console.error('Erro ao buscar perfil:', e);
      return null;
    }
  }, []);

  // Inicializar: checar sessão existente
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();

        if (mounted && existingSession?.user) {
          setSession(existingSession);
          const profile = await fetchProfile(existingSession.user.id);
          if (mounted) setUser(profile);
        }
      } catch (e) {
        console.error('Erro ao inicializar auth:', e);
      } finally {
        if (mounted) setInitializing(false);
      }
    }

    init();

    // Listener de mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth event:', event);

        if (mounted) {
          setSession(newSession);

          if (newSession?.user) {
            // Pequeno delay para dar tempo do trigger criar o perfil
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              setTimeout(async () => {
                const profile = await fetchProfile(newSession.user.id);
                if (mounted) setUser(profile);
              }, 500);
            }
          } else {
            setUser(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Criar conta
  const signUp = useCallback(async (email: string, password: string, nome: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { nome: nome.trim() },
        },
      });

      if (error) return { error };

      // Trigger handle_new_user() cria perfil em public.users automaticamente
      return { error: null };
    } finally {
      setLoading(false);
    }
  }, []);

  // Login
  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout
  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh manual do perfil (útil após onboarding)
  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const profile = await fetchProfile(session.user.id);
    if (profile) setUser(profile);
  }, [session, fetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        initializing,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
