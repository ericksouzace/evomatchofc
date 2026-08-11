import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/evo/session";
import { sportsQuery } from "@/lib/evo/profile";
import { socialGraphQuery, useSocialActions } from "@/lib/evo/social";
import { BottomNav } from "@/components/evo/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: () => ({
    meta: [
      { title: "Perfil — EvoMatch" },
      { name: "description", content: "Perfil esportivo de um atleta no EvoMatch." },
      { property: "og:title", content: "Perfil — EvoMatch" },
      { property: "og:description", content: "Perfil esportivo de um atleta no EvoMatch." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { username } = useParams({ from: "/_authenticated/u/$username" });
  const { user } = useSession();
  const userId = user?.id;
  const graph = useQuery(socialGraphQuery(userId));
  const sports = useQuery(sportsQuery);
  const { follow, connect, block } = useSocialActions(userId);

  const profile = useQuery({
    queryKey: ["profile", "public", username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username_lower", username.toLowerCase())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const userSports = useQuery({
    queryKey: ["user-sports", profile.data?.id],
    enabled: Boolean(profile.data?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_sports")
        .select("*")
        .eq("user_id", profile.data!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (profile.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!profile.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-xl font-semibold">Perfil não encontrado</h1>
        <p className="text-sm text-muted-foreground">
          Este usuário não existe ou o perfil não está visível para você.
        </p>
        <Button asChild variant="secondary">
          <Link to="/explorar">Voltar para Explorar</Link>
        </Button>
      </main>
    );
  }

  const p = profile.data;
  const isSelf = p.id === userId;
  const isFollowing = graph.data?.following.has(p.id) ?? false;
  const connection = (graph.data?.connections ?? []).find(
    (c) =>
      (c.requester_id === userId && c.addressee_id === p.id) ||
      (c.addressee_id === userId && c.requester_id === p.id),
  );
  const sportNames = new Map((sports.data ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border px-4 py-4 evo-safe-top">
        <div className="mx-auto w-full max-w-lg">
          <Link to="/explorar" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.display_name} /> : null}
              <AvatarFallback className="text-lg">
                {p.display_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold">{p.display_name}</h1>
              <p className="truncate text-sm text-muted-foreground">@{p.username}</p>
              {p.show_city && p.city ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {p.city}
                </p>
              ) : null}
            </div>
          </div>

          {!isSelf ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="flex-1"
                variant={isFollowing ? "secondary" : "default"}
                disabled={follow.isPending}
                onClick={() => follow.mutate({ targetId: p.id, following: isFollowing })}
              >
                {isFollowing ? "Seguindo" : "Seguir"}
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                disabled={connect.isPending || Boolean(connection)}
                onClick={() => connect.mutate(p.id)}
              >
                {connection?.status === "accepted"
                  ? "Conectados"
                  : connection?.status === "pending"
                    ? "Solicitação enviada"
                    : "Conectar"}
              </Button>
              <Button
                variant="secondary"
                aria-label="Bloquear usuário"
                disabled={block.isPending}
                onClick={() => block.mutate(p.id)}
              >
                <ShieldOff className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-5">
        {p.bio ? (
          <section className="evo-surface p-4">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sobre
            </h2>
            <p className="text-sm">{p.bio}</p>
          </section>
        ) : null}

        {p.goal ? (
          <section className="evo-surface p-4">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Objetivo
            </h2>
            <p className="text-sm">{p.goal}</p>
          </section>
        ) : null}

        <section className="evo-surface p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Modalidades
          </h2>
          {(userSports.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma modalidade pública.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {(userSports.data ?? []).map((us) => (
                <li key={us.id} className="rounded-full border border-border px-3 py-1 text-xs font-medium">
                  {sportNames.get(us.sport_id) ?? "Modalidade"}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
