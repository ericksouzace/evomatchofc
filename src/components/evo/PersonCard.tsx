import { Link } from "@tanstack/react-router";
import { UserPlus, UserCheck, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { DiscoveredPerson } from "@/lib/evo/social";

export function PersonCard({
  person,
  sportName,
  isFollowing,
  connectionStatus,
  onFollow,
  onConnect,
  busy,
}: {
  person: DiscoveredPerson;
  sportName?: string;
  isFollowing: boolean;
  connectionStatus: "none" | "pending" | "accepted";
  onFollow: () => void;
  onConnect: () => void;
  busy: boolean;
}) {
  return (
    <article className="evo-surface flex items-center gap-3 p-3">
      <Link to="/u/$username" params={{ username: person.username }} className="shrink-0">
        <Avatar className="h-12 w-12">
          {person.avatar_url ? <AvatarImage src={person.avatar_url} alt={person.display_name} /> : null}
          <AvatarFallback>{person.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to="/u/$username"
          params={{ username: person.username }}
          className="block truncate font-semibold"
        >
          {person.display_name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          @{person.username}
          {sportName ? " · " + sportName : ""}
          {person.city ? " · " + person.city : ""}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {person.distance_km !== null ? `~${person.distance_km} km` : "Distância indisponível"}
          {person.shared_sports > 0
            ? ` · ${person.shared_sports} modalidade${person.shared_sports > 1 ? "s" : ""} em comum`
            : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        <Button size="sm" variant={isFollowing ? "secondary" : "default"} onClick={onFollow} disabled={busy}>
          {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          <span className="sr-only">{isFollowing ? "Deixar de seguir" : "Seguir"}</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onConnect}
          disabled={busy || connectionStatus !== "none"}
          title={
            connectionStatus === "accepted"
              ? "Vocês já são conexões"
              : connectionStatus === "pending"
                ? "Solicitação pendente"
                : "Solicitar conexão"
          }
        >
          <Link2 className="h-4 w-4" />
          <span className="sr-only">Solicitar conexão</span>
        </Button>
      </div>
    </article>
  );
}
