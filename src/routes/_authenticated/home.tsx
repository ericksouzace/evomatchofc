import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Bell, Search, Loader2, MapPin, Activity, Users } from "lucide-react";
import { useSession } from "@/lib/evo/session";
import { myProfileQuery, sportsQuery } from "@/lib/evo/profile";
import { discoverPeopleQuery, socialGraphQuery, useSocialActions, usePendingConnections } from "@/lib/evo/social";
import { PersonCard } from "@/components/evo/PersonCard";
import { BottomNav } from "@/components/evo/BottomNav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Início — EvoMatch" },
      {
        name: "description",
        content:
          "Seu hub esportivo: pessoas compatíveis, o que está acontecendo agora e atalhos para treinar hoje.",
      },
      { property: "og:title", content: "Início — EvoMatch" },
      {
        property: "og:description",
        content: "Pessoas compatíveis, atividade local e atalhos para treinar hoje.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const userId = user?.id;

  const profile = useQuery(myProfileQuery(userId));
  const sports = useQuery(sportsQuery);
  const graph = useQuery(socialGraphQuery(userId));
  const pending = usePendingConnections(userId);
  const maxKm = profile.data?.max_distance_km ?? 25;
  const people = useQuery({
    ...discoverPeopleQuery(maxKm),
    enabled: Boolean(profile.data?.onboarding_completed),
  });
  const { follow, connect, respondConnection } = useSocialActions(userId);

  useEffect(() => {
    if (profile.data && !profile.data.onboarding_completed) {
      void navigate({ to: "/onboarding", replace: true });
    }
    if (profile.isSuccess && !profile.data) {
      void navigate({ to: "/onboarding", replace: true });
    }
  }, [profile.data, profile.isSuccess, navigate]);

  const sportName = useMemo(() => {
    const map = new Map((sports.data ?? []).map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? map.get(id) : undefined);
  }, [sports.data]);

  function connectionStatusFor(targetId: string): "none" | "pending" | "accepted" {
    const rows = graph.data?.connections ?? [];
    const row = rows.find(
      (c) =>
        (c.requester_id === userId && c.addressee_id === targetId) ||
        (c.addressee_id === userId && c.requester_id === targetId),
    );
    if (!row) return "none";
    if (row.status === "accepted") return "accepted";
    if (row.status === "pending") return "pending";
    return "none";
  }

  if (profile.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const me = profile.data;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur evo-safe-top">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-4 py-3">
          <Link to="/perfil" className="shrink-0">
            <Avatar className="h-10 w-10">
              {me?.avatar_url ? <AvatarImage src={me.avatar_url} alt={me.display_name} /> : null}
              <AvatarFallback>{(me?.display_name ?? "EV").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Olá, {me?.display_name?.split(" ")[0]}</p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {me?.city ?? "Localização não definida"}
            </p>
          </div>
          <Link
            to="/explorar"
            aria-label="Buscar"
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            to="/notificacoes"
            aria-label="Notificações"
            className="relative rounded-lg p-2 text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
            {(pending.data?.length ?? 0) > 0 ? (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
            ) : null}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-8 px-4 py-5">
        {(pending.data?.length ?? 0) > 0 ? (
          <section aria-labelledby="pending-title">
            <h2 id="pending-title" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Solicitações de conexão
            </h2>
            <div className="space-y-2">
              {(pending.data ?? []).map((row) => {
                const requester = row.requester as unknown as {
                  username: string;
                  display_name: string;
                  avatar_url: string | null;
                } | null;
                return (
                  <div key={row.id} className="evo-surface flex items-center gap-3 p-3">
                    <Avatar className="h-10 w-10">
                      {requester?.avatar_url ? (
                        <AvatarImage src={requester.avatar_url} alt={requester.display_name} />
                      ) : null}
                      <AvatarFallback>
                        {(requester?.display_name ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{requester?.display_name}</p>
                      <p className="truncate text-xs text-muted-foreground">@{requester?.username}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => respondConnection.mutate({ id: row.id, accept: true })}
                      disabled={respondConnection.isPending}
                    >
                      Aceitar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => respondConnection.mutate({ id: row.id, accept: false })}
                      disabled={respondConnection.isPending}
                    >
                      Recusar
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="pulse-title">
          <h2 id="pulse-title" className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Activity className="h-5 w-5 text-primary" />
            Acontecendo agora
          </h2>
          <div className="evo-surface p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não há atividade esportiva pública registrada num raio de {maxKm} km. O Evo Pulse
              mostra apenas movimento real — nada é inventado.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link to="/explorar">Explorar pessoas</Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/perfil">Completar meu perfil</Link>
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="people-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="people-title" className="flex items-center gap-2 text-lg font-bold">
              <Users className="h-5 w-5 text-primary" />
              Pessoas compatíveis
            </h2>
            <Link to="/explorar" className="text-sm font-medium text-primary">
              Ver tudo
            </Link>
          </div>

          {people.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : people.isError ? (
            <div className="evo-surface p-4 text-center">
              <p className="text-sm text-destructive">Não foi possível carregar recomendações.</p>
              <Button size="sm" className="mt-3" onClick={() => void people.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (people.data?.length ?? 0) === 0 ? (
            <div className="evo-surface p-5 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma pessoa compatível encontrada até {maxKm} km. Aumente o raio no seu perfil ou
                convide alguém para o EvoMatch.
              </p>
              <Button variant="secondary" size="sm" className="mt-4" asChild>
                <Link to="/perfil">Ajustar preferências</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {(people.data ?? []).map((person) => (
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
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
