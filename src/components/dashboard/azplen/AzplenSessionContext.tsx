import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AshaSession {
  id: string;
  name: string;
  companyName: string;
  description: string;
  icon: string;
  isActive: boolean;
  createdAt: string;
}

interface AzplenSessionContextType {
  sessions: AshaSession[];
  activeSession: AshaSession | null;
  setActiveSession: (session: AshaSession) => void;
  createSession: (name: string, companyName: string, description?: string) => Promise<AshaSession | null>;
  renameSession: (id: string, newName: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  loading: boolean;
}

const AzplenSessionContext = createContext<AzplenSessionContextType>({
  sessions: [], activeSession: null, setActiveSession: () => {}, createSession: async () => null, renameSession: async () => {}, deleteSession: async () => {}, loading: true,
});

export const useAzplenSession = () => useContext(AzplenSessionContext);

export const AzplenSessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessions, setSessions] = useState<AshaSession[]>([]);
  const [activeSession, setActiveSessionState] = useState<AshaSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("asha_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (data && data.length > 0) {
        const mapped = data.map((s: any) => ({
          id: s.id, name: s.name, companyName: s.company_name, description: s.description,
          icon: s.icon, isActive: s.is_active, createdAt: s.created_at,
        }));
        setSessions(mapped);
        const active = mapped.find(s => s.isActive) || mapped[0];
        setActiveSessionState(active);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const setActiveSession = async (session: AshaSession) => {
    setActiveSessionState(session);
    // Mark as active in DB, unmark others
    if (user) {
      await supabase.from("asha_sessions").update({ is_active: false }).eq("user_id", user.id);
      await supabase.from("asha_sessions").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", session.id);
    }
  };

  const createSession = async (name: string, companyName: string, description = ""): Promise<AshaSession | null> => {
    if (!user) {
      toast.error("You must be logged in to create a session.");
      return null;
    }
    try {
      // Unmark current active
      await supabase.from("asha_sessions").update({ is_active: false }).eq("user_id", user.id);

      const { data, error } = await supabase.from("asha_sessions").insert({
        user_id: user.id, name, company_name: companyName, description, is_active: true,
      }).select().single();

      if (error) {
        console.error("AZPLEN session create error:", error);
        toast.error(`Failed to create session: ${error.message}`);
        return null;
      }

      if (data) {
        const session: AshaSession = {
          id: data.id, name: data.name, companyName: data.company_name, description: data.description,
          icon: data.icon, isActive: true, createdAt: data.created_at,
        };
        setSessions(prev => [session, ...prev.map(s => ({ ...s, isActive: false }))]);
        setActiveSessionState(session);
        toast.success("Session created");
        return session;
      }
    } catch (err) {
      console.error("AZPLEN session create exception:", err);
      toast.error("Unexpected error creating session.");
    }
    return null;
  };

  const renameSession = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    await supabase.from("asha_sessions").update({ name: newName.trim() }).eq("id", id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name: newName.trim() } : s));
    if (activeSession?.id === id) {
      setActiveSessionState({ ...activeSession, name: newName.trim() });
    }
  };

  const deleteSession = async (id: string) => {
    await supabase.from("asha_sessions").delete().eq("id", id);
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== id);
      if (activeSession?.id === id && remaining.length > 0) {
        setActiveSession(remaining[0]);
      } else if (remaining.length === 0) {
        setActiveSessionState(null);
      }
      return remaining;
    });
  };

  return (
    <AzplenSessionContext.Provider value={{ sessions, activeSession, setActiveSession, createSession, renameSession, deleteSession, loading }}>
      {children}
    </AzplenSessionContext.Provider>
  );
};
