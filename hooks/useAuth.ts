import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as DBUser } from '@/types/database'; // tu tipo de fila de la tabla users

export function useAuth() {
  const [user, setUser] = useState<DBUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data as DBUser);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1) Sesión inicial
    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user && isMounted) {
          setLoading(true);
          await fetchUserProfile(session.user.id);
        } else if (isMounted) {
          setLoading(false);
        }
      } catch (err) {
        console.error('getSession error:', err);
        if (isMounted) setLoading(false);
      }
    })();

    // 2) Suscripción a cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setLoading(true);
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error };
      // El onAuthStateChange disparará fetchUserProfile
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'passenger' | 'driver',
    userType: 'adult' | 'child' | 'student' | 'driver',
    documentNumber: string
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            user_type: userType,
            document_number: documentNumber,
          },
        },
      });

      if (error) return { data, error };

      // Ojo: si tienes verificación por email, puede que no haya sesión todavía.
      // En ese caso, espera a que el usuario confirme y luego se loguee.
      return { data, error: null };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      setUser(null);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, signIn, signUp, signOut };
}
