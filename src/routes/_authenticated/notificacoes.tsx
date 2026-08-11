import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Bell } from "lucide-react";
import { useSession } from "@/lib/evo/session";
import { usePendingConnections, useSocialActions } from "@/lib/evo/social";
import { BottomNav } from "@/components/evo/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — EvoMatch" },
      { name: "description", content: "Solicitações de conexão e novidades da sua rede esportiva." },
      { property: "og:title", content: "Notificações — EvoMatch" },
      { property: "og:description", content: "Solicitações de conexão e novidades da sua rede." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useSession();
  const pending = usePendingConnections(user?.id);
  const { respondConnection } = useSocialActions(user?.id);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border px-4 py-4 evo-safe-top">
        <div className="mx-auto flex w-full max-w-lg items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Notificações</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-3 px-4 py-5">
        {pending.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (pending.data?.length ?? 0) === 0 ? (
          <div className="evo-surface p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nada por aqui ainda. Solicitações de conexão aparecem nesta tela.
            </p>
            <Button variant="secondary" size="sm" className="mt-4" asChild>
              <Link to="/explorar">Explorar pessoas</Link>
            </Button>
          </div>
        ) : (
          (pending.data ?? []).map((row) => {
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
                  <p className="truncate text-sm font-medium">
                    {requester?.display_name} quer se conectar
                  </p>
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
          })
        )}
      </main>

      <BottomNav />
    </div>
  );
}
