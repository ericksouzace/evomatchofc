import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/evo/session";
import { myProfileQuery, sportsQuery } from "@/lib/evo/profile";
import { discoverPeopleQuery, socialGraphQuery, useSocialActions } from "@/lib/evo/social";
import type { DiscoveredPerson } from "@/lib/evo/social";
import { PersonCard } from "@/components/evo/PersonCard";
import { BottomNav } from "@/components/evo/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/explorar")({
  head: () => ({
    meta: [
      { title: "Explorar — EvoMatch" },
      {
        name: "description",
        content: "Encontre pessoas por modalidade, distância e username dentro do EvoMatch.",
      },
      { property: "og:title", content: "Explorar — EvoMatch" },
      {
        property: "og:description",
        content: "Encontre pessoas por modalidade, distância e username no EvoMatch.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExplorePage,
});

/** Normaliza acentos e variações comuns ("beach tenis" -> "beach tennis"). */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ExplorePage() {
  const { user } = useSession();
  const userId = user?.id;
  const [term, setTerm] = useState("");
  const [sportFilter, setSportFilter] = useState<string | null>(null);

  const profile = useQuery(myProfileQuery(userId));
  const sports = useQuery(sportsQuery);
  const graph = useQuery(socialGraphQuery(userId));
  const maxKm = profile.data?.max_distance_km ?? 25;
  const people = useQuery(discoverPeopleQuery(maxKm, sportFilter));
  const { follow, connect } = useSocialActions(userId);

  const search = useQuery({
    queryKey: ["search-people", normalize(term)],
    enabled: normalize(term).length >= 2,
    queryFn: async (): Promise<DiscoveredPerson[]> => {
      const value = normalize(term);
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,city,primary_sport_id,experience_level,show_city")
        .or(`username_lower.ilike.%${value}%,display_name.ilike.%${value}%`)
        .neq("id", userId ?? "")
        .limit(25);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        username: row.username,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        city: row.show_city ? row.city : null,
        primary_sport_id: row.primary_sport_id,
        experience_level: row.experience_level,
        distance_km: null,
        shared_sports: 0,
      }));
    },
  });

  const sportName = useMemo(() => {
    const map = new Map((sports.data ?? []).map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? map.get(id) : undefined);
  }, [sports.data]);

  function connectionStatusFor(targetId: string): "none" | "pending" | "accepted" {
    const row = (graph.data?.connections ?? []).find(
      (c) =>
        (c.requester_id === userId && c.addressee_id === targetId) ||
        (c.addressee_id === userId && c.requester_id === targetId),
    );
    if (!row) return "none";
    if (row.status === "accepted") return "accepted";
    if (row.status === "pending") return "pending";
    return "none";
  }

  const searching = normalize(term).length >= 2;
  const list = searching ? (search.data ?? []) : (people.data ?? []);
  const loading = searching ? search.isLoading : people.isLoading;
  const errored = searching ? search.isError : people.isError;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur evo-safe-top">
        <div className="mx-auto w-full max-w-lg">
          <h1 className="text-lg font-bold">Explorar</h1>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar pessoas por nome ou @username"
              className="pl-9"
              aria-label="Buscar pessoas"
            />
          </div>
          {!searching ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSportFilter(null)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                  sportFilter === null
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                Todos
              </button>
              {(sports.data ?? []).map((sport) => (
                <button
                  key={sport.id}
                  type="button"
                  onClick={() => setSportFilter(sport.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                    sportFilter === sport.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {sport.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-3 px-4 py-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : errored ? (
          <div className="evo-surface p-4 text-center">
            <p className="text-sm text-destructive">Não foi possível carregar os resultados.</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => (searching ? void search.refetch() : void people.refetch())}
            >
              Tentar novamente
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className="evo-surface p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {searching
                ? "Nenhuma pessoa encontrada com esse termo."
                : `Nenhuma pessoa cadastrada dentro de ${maxKm} km ainda.`}
            </p>
          </div>
        ) : (
          list.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              sportName={sportName(person.primary_sport_id)}
              isFollowing={graph.data?.following.has(person.id) ?? false}
              connectionStatus={connectionStatusFor(person.id)}
              busy={follow.isPending || connect.isPending}
              onFollow={() =>
                follow.mutate({
                  targetId: person.id,
                  following: graph.data?.following.has(person.id) ?? false,
                })
              }
              onConnect={() => connect.mutate(person.id)}
            />
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
