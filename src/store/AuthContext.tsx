import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  status: string;
  avatar_url?: string;
  roles?: {
    name: string;
  };
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase()
          .from('profiles')
          .select('*, roles(name)')
          .eq('id', userId)
          .single();
      
      if (error) {
          console.error("Error fetching profile", error);
          return null;
      }
      
      // Try local storage fallback for avatar
      if (data) {
        // Normalize roles join (sometimes returns as array or fails to join depending on system state)
        if (data.roles && Array.isArray(data.roles)) {
          data.roles = data.roles[0];
        } else if (!data.roles && data.role_id) {
          try {
            const { data: roleData } = await supabase()
              .from('roles')
              .select('name')
              .eq('id', data.role_id)
              .maybeSingle();
            if (roleData) {
              data.roles = { name: roleData.name };
            }
          } catch (err) {
            console.error("Failed to fetch role name manually", err);
          }
        }

        // Defensive fallback: if email is admin@apldms.local, guarantee it is Administrator
        if (data.email?.toLowerCase().trim() === 'admin@apldms.local') {
          data.roles = { name: 'Administrator' };
        }

        const localAvatar = localStorage.getItem(`avatar_${userId}`);
        if (localAvatar && !data.avatar_url) {
          data.avatar_url = localAvatar;
        }
      }
      return data;
    } catch(e) {
      console.error("Exception fetching profile", e);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const data = await fetchProfile(user.id);
      if (data) {
        setProfile(data);
      }
    }
  };

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setLoading(false);
      return;
    }

    // Safety timeout to ensure loading gets dismissed if Supabase connection hangs
    const safetyTimeout = setTimeout(() => {
      console.warn("Auth check timed out. Proceeding to prevent infinite loading screen.");
      setLoading(false);
    }, 20000);

    const { data: { subscription } } = supabase().auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        const currentUser = session?.user || null;
        setUser(currentUser);
        
        if (currentUser) {
          let data = await fetchProfile(currentUser.id);
          
          if (!data) {
            console.warn("User has auth session but no profiles record. Auto-creating self-healing profile...");
            try {
              // Attempt to fetch 'Administrator' role first
              const { data: adminRole } = await supabase()
                .from('roles')
                .select('id')
                .eq('name', 'Administrator')
                .maybeSingle();

              let targetRoleId = adminRole?.id;

              if (!targetRoleId) {
                // Fetch first available role as fallback if Administrator is absent
                const { data: anyRoles } = await supabase()
                  .from('roles')
                  .select('id')
                  .limit(1);
                if (anyRoles && anyRoles.length > 0) {
                  targetRoleId = anyRoles[0].id;
                }
              }

              if (targetRoleId) {
                const { error: insertError } = await supabase()
                  .from('profiles')
                  .upsert({
                    id: currentUser.id,
                    email: currentUser.email || 'admin@apldms.local',
                    full_name: currentUser.email ? (currentUser.email.split('@')[0].charAt(0).toUpperCase() + currentUser.email.split('@')[0].slice(1)) : 'System User',
                    role_id: targetRoleId,
                    status: 'Active'
                  });

                if (!insertError) {
                  data = await fetchProfile(currentUser.id);
                } else {
                  console.error("Failed to auto-create profile:", insertError);
                }
              }
            } catch (err) {
              console.error("Exception during profile self-healing initialization:", err);
            }
          }

          if (data && data.status !== 'Active') {
              try {
                await supabase().auth.signOut();
              } catch (err) {
                console.error("Error signing out user", err);
              }
              setUser(null);
              setProfile(null);
              setSession(null);
          } else {
              setProfile(data);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const signOut = async () => {
    // Clear state immediately to avoid UI lag/hanging
    setUser(null);
    setSession(null);
    setProfile(null);
    if (hasSupabaseConfig()) {
      try {
        await supabase().auth.signOut();
      } catch (err) {
        console.error("Error signing out from Supabase:", err);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
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
