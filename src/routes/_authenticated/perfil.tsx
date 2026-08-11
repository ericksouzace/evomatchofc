import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut, MapPin, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/evo/session";
import { myProfileQuery, myUserSportsQuery, sportsQuery } from "@/lib/evo/profile";
import { socialGraphQuery } from "@/lib/evo/social";
import { BottomNav } from "@/components/evo/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — EvoMatch" },
      {
        name: "description",
        content: "Gerencie seu perfil esportivo, privacidade, raio de descoberta e modalidades.",
      },
      { property: "og:title", content: "Meu perfil — EvoMatch" },
      {
        property: "og:description",
        content: "Gerencie perfil esportivo, privacidade e preferências de descoberta.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const profile = useQuery(myProfileQuery(userId));
  const sports = useQuery(sportsQuery);
  const mySports = useQuery(myUserSportsQuery(userId));
  const graph = useQuery(socialGraphQuery(userId));

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [goal, setGoal] = useState("");
  const [maxDistance, setMaxDistance] = useState(25);
  const [showCity, setShowCity] = useState(true);
  const [discoverable, setDiscoverable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setDisplayName(p.display_name ?? "");
    setBio(p.bio ?? "");
    setCity(p.city ?? "");
    setGoal(p.goal ?? "");
    setMaxDistance(p.max_distance_km ?? 25);
    setShowCity(p.show_city ?? true);
    setDiscoverable(p.is_discoverable ?? true);
  }, [profile.data]);

  async function handleSave() {
    if (!userId) return;
    if (displayName.trim().length < 2) {
      toast.error("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        city: city.trim() || null,
        goal: goal.trim() || null,
        max_distance_km: maxDistance,
        show_city: showCity,
        is_discoverable: discoverable,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile", "me", userId] });
    void queryClient.invalidateQueries({ queryKey: ["discover-people"] });
    toast.success("Perfil atualizado.");
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  if (profile.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const p = profile.data;
  const sportNames = new Map((sports.data ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border px-4 py-5 evo-safe-top">
        <div className="mx-auto flex w-full max-w-lg items-center gap-4">
          <Avatar className="h-16 w-16">
            {p?.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.display_name} /> : null}
            <AvatarFallback className="text-lg">
              {(p?.display_name ?? "EV").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{p?.display_name}</h1>
            <p className="truncate text-sm text-muted-foreground">@{p?.username}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {p?.city ?? "Sem cidade definida"}
            </p>
          </div>
        </div>

        <div className="mx-auto mt-4 grid w-full max-w-lg grid-cols-3 gap-2 text-center">
          <Stat label="Seguindo" value={graph.data?.following.size ?? 0} />
          <Stat label="Seguidores" value={graph.data?.followersCount ?? 0} />
          <Stat
            label="Conexões"
            value={(graph.data?.connections ?? []).filter((c) => c.status === "accepted").length}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-5">
        <section className="evo-surface space-y-4 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dados do perfil
          </h2>
          <div className="space-y-2">
            <Label htmlFor="display-name">Nome de exibição</Label>
            <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal">Objetivo atual</Label>
            <Input id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={120} />
          </div>
        </section>

        <section className="evo-surface space-y-4 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Descoberta e privacidade
          </h2>
          <div className="space-y-2">
            <Label htmlFor="radius">Raio de descoberta: {maxDistance} km</Label>
            <Slider
              id="radius"
              value={[maxDistance]}
              min={1}
              max={200}
              step={1}
              onValueChange={(v) => setMaxDistance(v[0] ?? 25)}
            />
          </div>
          <ToggleRow
            label="Mostrar minha cidade"
            description="Sua cidade aparece no seu perfil público."
            checked={showCity}
            onChange={setShowCity}
          />
          <ToggleRow
            label="Aparecer nas descobertas"
            description="Desligado, você não aparece nas buscas por proximidade."
            checked={discoverable}
            onChange={setDiscoverable}
          />
        </section>

        <section className="evo-surface space-y-3 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Minhas modalidades
          </h2>
          {mySports.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (mySports.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma modalidade selecionada.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {(mySports.data ?? []).map((us) => (
                <li
                  key={us.id}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground"
                >
                  {sportNames.get(us.sport_id) ?? "Modalidade"}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button className="w-full" onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </Button>

        <Button variant="secondary" className="w-full" onClick={() => void handleSignOut()}>
          <LogOut className="h-4 w-4" />
          Sair da conta
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="evo-surface py-2">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
