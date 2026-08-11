import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Sport = Tables<"sports">;
export type UserSport = Tables<"user_sports">;

export const sportsQuery = queryOptions({
  queryKey: ["sports"],
  staleTime: 1000 * 60 * 60,
  queryFn: async (): Promise<Sport[]> => {
    const { data, error } = await supabase
      .from("sports")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
});

export function myProfileQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["profile", "me", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function myUserSportsQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["user-sports", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<UserSport[]> => {
      const { data, error } = await supabase
        .from("user_sports")
        .select("*")
        .eq("user_id", userId!)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Checks username availability (case-insensitive) against real rows. */
export async function isUsernameAvailable(username: string, selfId?: string) {
  const value = username.trim().toLowerCase();
  if (!/^[a-z0-9._]{3,24}$/.test(value)) return false;

  const reserved = await supabase
    .from("reserved_usernames")
    .select("username")
    .eq("username", value)
    .maybeSingle();
  if (reserved.error) throw reserved.error;
  if (reserved.data) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username_lower", value)
    .maybeSingle();
  if (error) throw error;
  if (!data) return true;
  return data.id === selfId;
}
