import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DiscoveredPerson = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  primary_sport_id: string | null;
  experience_level: string | null;
  distance_km: number | null;
  shared_sports: number;
};

export function discoverPeopleQuery(maxKm: number, sportId?: string | null) {
  return queryOptions({
    queryKey: ["discover-people", maxKm, sportId ?? null],
    queryFn: async (): Promise<DiscoveredPerson[]> => {
      const params: { _max_km: number; _limit: number; _sport_id?: string } = {
        _max_km: maxKm,
        _limit: 30,
      };
      if (sportId) params._sport_id = sportId;
      const { data, error } = await supabase.rpc("discover_people", params);
      if (error) throw error;
      return (data ?? []) as DiscoveredPerson[];
    },
  });
}

export function socialGraphQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["social-graph", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [following, followers, connections] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", userId!),
        supabase.from("follows").select("follower_id").eq("following_id", userId!),
        supabase
          .from("connections")
          .select("*")
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
      ]);
      if (following.error) throw following.error;
      if (followers.error) throw followers.error;
      if (connections.error) throw connections.error;
      return {
        following: new Set((following.data ?? []).map((r) => r.following_id)),
        followersCount: (followers.data ?? []).length,
        connections: (connections.data ?? []) as Tables<"connections">[],
      };
    },
  });
}

export function useSocialActions(userId: string | undefined) {
  const queryClient = useQueryClient();

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["social-graph", userId] });
    void queryClient.invalidateQueries({ queryKey: ["discover-people"] });
  }

  const follow = useMutation({
    mutationFn: async ({ targetId, following }: { targetId: string; following: boolean }) => {
      if (!userId) throw new Error("Sessão expirada.");
      if (following) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", userId)
          .eq("following_id", targetId);
        if (error) throw error;
        return "unfollowed" as const;
      }
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: userId, following_id: targetId });
      if (error) throw error;
      return "followed" as const;
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(result === "followed" ? "Seguindo." : "Deixou de seguir.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const connect = useMutation({
    mutationFn: async (targetId: string) => {
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase
        .from("connections")
        .insert({ requester_id: userId, addressee_id: targetId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Solicitação de conexão enviada.");
    },
    onError: (error: { message: string; code?: string }) =>
      toast.error(
        error.code === "23505" ? "Já existe uma solicitação com esta pessoa." : error.message,
      ),
  });

  const respondConnection = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase
        .from("connections")
        .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Solicitação respondida.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const block = useMutation({
    mutationFn: async (targetId: string) => {
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase
        .from("blocks")
        .insert({ blocker_id: userId, blocked_id: targetId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Usuário bloqueado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { follow, connect, respondConnection, block };
}

export function usePendingConnections(userId: string | undefined) {
  return useQuery({
    queryKey: ["connections", "pending", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connections")
        .select("*, requester:profiles!connections_requester_id_fkey(id,username,display_name,avatar_url)")
        .eq("addressee_id", userId!)
        .eq("status", "pending");
      if (error) throw error;
      return data ?? [];
    },
  });
}
