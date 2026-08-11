import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/evo/session";
import { myProfileQuery, myUserSportsQuery, sportsQuery } from "@/lib/evo/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Personalize seu EvoMatch" },
      {
        name: "description",
        content:
          "Configure modalidades, objetivos, disponibilidade e distância para receber recomendações reais no EvoMatch.",
      },
      { property: "og:title", content: "Personalize seu EvoMatch" },
      {
        property: "og:description",
        content: "Configure modalidades, objetivos e disponibilidade no EvoMatch.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

const TOTAL_STEPS = 7;

const LEVELS = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
  { value: "atleta", label: "Atleta" },
] as const;

const INTENTS = [
  { value: "companhia", label: "Companhia de treino" },
  { value: "amizade", label: "Amizade" },
  { value: "profissional", label: "Profissional / treinador" },
  { value: "academia", label: "Academia ou local" },
  { value: "evento", label: "Eventos e provas" },
  { value: "comunidade", label: "Comunidade / grupo" },
] as const;

const INTENSITIES = [
  { value: "recreativo", label: "Recreativo" },
  { value: "moderado", label: "Moderado" },
  { value: "consistente", label: "Consistente" },
  { value: "performance", label: "Performance" },
  { value: "competitivo", label: "Competitivo" },
] as const;

const DAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const PERIODS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
  { value: "madrugada", label: "Madrugada" },
];

function Chip({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
        selected
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const sports = useQuery(sportsQuery);
  const profile = useQuery(myProfileQuery(userId));
  const userSports = useQuery(myUserSportsQuery(userId));

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // form state
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [primarySport, setPrimarySport] = useState<string | null>(null);
  const [places, setPlaces] = useState("");
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<string | null>(null);
  const [intent, setIntent] = useState<string[]>([]);
  const [weeklyFrequency, setWeeklyFrequency] = useState(3);
  const [days, setDays] = useState<number[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [maxDistance, setMaxDistance] = useState(10);
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "denied" | "granted">("idle");

  // Retoma exatamente de onde parou (persistido no backend).
  useEffect(() => {
    if (hydrated) return;
    const p = profile.data;
    const us = userSports.data;
    if (!p || !us) return;

    setSelectedSports(us.map((s) => s.sport_id));
    setPrimarySport(p.primary_sport_id ?? us.find((s) => s.is_primary)?.sport_id ?? null);
    setPlaces((p.training_places ?? []).join(", "));
    setGoal(p.goal ?? "");
    setLevel(p.experience_level);
    setIntensity(p.training_intensity);
    setIntent(p.intent ?? []);
    setWeeklyFrequency(p.weekly_frequency ?? 3);
    setDays(p.available_days ?? []);
    setPeriods(p.available_periods ?? []);
    setMaxDistance(p.max_distance_km ?? 10);
    setCity(p.city ?? "");
    setStep(Math.min(TOTAL_STEPS, Math.max(1, (p.onboarding_step || 0) + 1)));
    setHydrated(true);
  }, [profile.data, userSports.data, hydrated]);

  useEffect(() => {
    if (profile.data?.onboarding_completed) {
      void navigate({ to: "/home", replace: true });
    }
  }, [profile.data?.onboarding_completed, navigate]);

  const sportsById = useMemo(
    () => new Map((sports.data ?? []).map((s) => [s.id, s])),
    [sports.data],
  );

  async function persist(nextStep: number, completed = false) {
    if (!userId) return false;
    setSaving(true);
    try {
      const payload = {
        onboarding_step: nextStep - 1,
        onboarding_completed: completed,
        primary_sport_id: primarySport,
        goal: goal.trim() || null,
        experience_level: level,
        training_intensity: intensity,
        intent,
        weekly_frequency: weeklyFrequency,
        available_days: days,
        available_periods: periods,
        max_distance_km: maxDistance,
        city: city.trim() || null,
        training_places: places
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
      if (error) throw error;

      if (coords) {
        const { error: locError } = await supabase.rpc("set_my_location", {
          _lat: coords.lat,
          _lng: coords.lng,
          _precision: "approximate",
        });
        if (locError) throw locError;
      }

      // sincroniza modalidades escolhidas
      const existing = userSports.data ?? [];
      const toRemove = existing.filter((s) => !selectedSports.includes(s.sport_id));
      if (toRemove.length) {
        const { error: delError } = await supabase
          .from("user_sports")
          .delete()
          .in(
            "id",
            toRemove.map((s) => s.id),
          );
        if (delError) throw delError;
      }
      if (selectedSports.length) {
        const rows = selectedSports.map((sportId, index) => ({
          user_id: userId,
          sport_id: sportId,
          is_primary: sportId === primarySport,
          priority: index,
          level,
          goal: goal.trim() || null,
          weekly_frequency: weeklyFrequency,
        }));
        const { error: upError } = await supabase
          .from("user_sports")
          .upsert(rows, { onConflict: "user_id,sport_id" });
        if (upError) throw upError;
      }

      await queryClient.invalidateQueries({ queryKey: ["profile", "me", userId] });
      await queryClient.invalidateQueries({ queryKey: ["user-sports", userId] });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar.";
      toast.error("Não foi possível salvar: " + message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function requestGeolocation() {
    if (!("geolocation" in navigator)) {
      setGeoState("denied");
      toast.error("Seu dispositivo/navegador não oferece geolocalização. Informe a cidade.");
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeoState("granted");
      },
      () => {
        setGeoState("denied");
        toast.message("Sem GPS agora — informe sua cidade manualmente.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  const canAdvance = (() => {
    switch (step) {
      case 1:
        return selectedSports.length > 0;
      case 2:
        return Boolean(primarySport);
      case 3:
        return Boolean(level) && Boolean(intensity);
      case 4:
        return intent.length > 0;
      case 5:
        return days.length > 0 && periods.length > 0;
      case 6:
        return maxDistance > 0;
      case 7:
        return Boolean(coords) || city.trim().length >= 2;
      default:
        return false;
    }
  })();

  async function next() {
    if (!canAdvance) return;
    const completed = step === TOTAL_STEPS;
    const ok = await persist(step + (completed ? 0 : 1), completed);
    if (!ok) return;
    if (completed) {
      toast.success("Perfil configurado.");
      void navigate({ to: "/home", replace: true });
      return;
    }
    setStep((s) => s + 1);
  }

  if (profile.isLoading || sports.isLoading || userSports.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (profile.isError || sports.isError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-destructive">Não foi possível carregar seus dados.</p>
        <Button
          onClick={() => {
            void profile.refetch();
            void sports.refetch();
          }}
        >
          Tentar novamente
        </Button>
      </main>
    );
  }

  if (!profile.data) {
    return <ProfileBootstrap userId={userId} />;
  }

  return (
    <main className="min-h-screen bg-background px-5 pb-28 evo-safe-top">
      <header className="mx-auto flex w-full max-w-lg items-center gap-3 py-4">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          aria-label="Voltar"
          className="rounded-lg p-2 text-muted-foreground disabled:opacity-40"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {step} de {TOTAL_STEPS}
        </span>
      </header>

      <div className="mx-auto w-full max-w-lg space-y-6">
        {step === 1 ? (
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Quais esportes você pratica ou deseja praticar?
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione um ou mais esportes. Você pode escolher quantos quiser.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(sports.data ?? []).map((sport) => (
                <Chip
                  key={sport.id}
                  selected={selectedSports.includes(sport.id)}
                  onClick={() =>
                    setSelectedSports((prev) =>
                      prev.includes(sport.id)
                        ? prev.filter((id) => id !== sport.id)
                        : [...prev, sport.id],
                    )
                  }
                >
                  {sport.name}
                </Chip>
              ))}
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Qual é o seu esporte principal?
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ele recebe maior peso nas recomendações.
            </p>
            <div className="mt-5 space-y-3">
              {selectedSports.map((id, index) => {
                const sport = sportsById.get(id);
                if (!sport) return null;
                const selected = primarySport === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPrimarySport(id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left",
                      selected ? "border-primary bg-primary/10" : "border-border bg-card",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{index + 1}</span>
                      <span className="font-medium">{sport.name}</span>
                    </span>
                    {selected ? <Check className="h-5 w-5 text-primary" /> : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 space-y-2">
              <Label htmlFor="places">Onde você costuma treinar? (opcional)</Label>
              <Input
                id="places"
                value={places}
                onChange={(e) => setPlaces(e.target.value)}
                placeholder="Parque do Cocó, Smart Fit Aldeota"
              />
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight">Sua experiência e intensidade</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Isso evita recomendações incompatíveis.
            </p>
            <div className="mt-5">
              <Label className="text-sm">Nível</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {LEVELS.map((option) => (
                  <Chip
                    key={option.value}
                    selected={level === option.value}
                    onClick={() => setLevel(option.value)}
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <Label className="text-sm">Intensidade de treino</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {INTENSITIES.map((option) => (
                  <Chip
                    key={option.value}
                    selected={intensity === option.value}
                    onClick={() => setIntensity(option.value)}
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <Label htmlFor="goal">Seu objetivo esportivo</Label>
              <Textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={280}
                placeholder="Ex.: correr 10 km sem parar até dezembro"
              />
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight">O que você procura no EvoMatch?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pode escolher mais de uma opção.</p>
            <div className="mt-5 grid gap-3">
              {INTENTS.map((option) => (
                <Chip
                  key={option.value}
                  selected={intent.includes(option.value)}
                  onClick={() =>
                    setIntent((prev) =>
                      prev.includes(option.value)
                        ? prev.filter((v) => v !== option.value)
                        : [...prev, option.value],
                    )
                  }
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </section>
        ) : null}

        {step === 5 ? (
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight">Sua rotina de treino</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Usamos isso para sugerir pessoas e convites compatíveis.
            </p>
            <div className="mt-5">
              <Label className="text-sm">Treinos por semana: {weeklyFrequency}x</Label>
              <Slider
                className="mt-3"
                min={1}
                max={14}
                step={1}
                value={[weeklyFrequency]}
                onValueChange={([value]) => setWeeklyFrequency(value ?? 3)}
              />
            </div>
            <div className="mt-6">
              <Label className="text-sm">Dias disponíveis</Label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {DAYS.map((day) => (
                  <Chip
                    key={day.value}
                    selected={days.includes(day.value)}
                    onClick={() =>
                      setDays((prev) =>
                        prev.includes(day.value)
                          ? prev.filter((v) => v !== day.value)
                          : [...prev, day.value],
                      )
                    }
                  >
                    {day.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <Label className="text-sm">Períodos</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PERIODS.map((period) => (
                  <Chip
                    key={period.value}
                    selected={periods.includes(period.value)}
                    onClick={() =>
                      setPeriods((prev) =>
                        prev.includes(period.value)
                          ? prev.filter((v) => v !== period.value)
                          : [...prev, period.value],
                      )
                    }
                  >
                    {period.label}
                  </Chip>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {step === 6 ? (
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Até que distância você aceita se deslocar?
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Filtra pessoas, locais, profissionais e atividades.
            </p>
            <div className="mt-8 text-center">
              <span className="text-5xl font-extrabold text-primary">{maxDistance}</span>
              <span className="ml-1 text-lg text-muted-foreground">km</span>
            </div>
            <Slider
              className="mt-6"
              min={1}
              max={100}
              step={1}
              value={[maxDistance]}
              onValueChange={([value]) => setMaxDistance(value ?? 10)}
            />
          </section>
        ) : null}

        {step === 7 ? (
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight">Onde você treina?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A localização aproximada mostra pessoas, locais e eventos perto de você. Nunca exibimos
              seu endereço exato para outras pessoas.
            </p>

            <Button
              type="button"
              className="mt-6 w-full"
              variant={geoState === "granted" ? "secondary" : "default"}
              onClick={requestGeolocation}
              disabled={geoState === "loading"}
            >
              {geoState === "loading" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="mr-2 h-4 w-4" />
              )}
              {geoState === "granted" ? "Localização capturada" : "Usar minha localização"}
            </Button>

            {geoState === "denied" ? (
              <p className="mt-3 text-sm text-warning">
                Permissão negada. Sem problema: informe sua cidade abaixo.
              </p>
            ) : null}

            <div className="mt-6 space-y-2">
              <Label htmlFor="city">Cidade / região</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Fortaleza, CE"
              />
            </div>
          </section>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur evo-safe-bottom">
        <div className="mx-auto w-full max-w-lg">
          <Button className="w-full" onClick={next} disabled={!canAdvance || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {step === TOTAL_STEPS ? "Concluir" : "Continuar"}
          </Button>
        </div>
      </div>
    </main>
  );
}

/** Cria o perfil quando a conta veio de OAuth e ainda não tem registro. */
function ProfileBootstrap({ userId }: { userId: string | undefined }) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(
    (user?.user_metadata?.["display_name"] as string) ??
      (user?.user_metadata?.["full_name"] as string) ??
      "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setError(null);
    const handle = username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,24}$/.test(handle)) {
      setError("Username: 3 a 24 caracteres (letras, números, ponto ou underline).");
      return;
    }
    if (displayName.trim().length < 2) {
      setError("Informe seu nome.");
      return;
    }
    setBusy(true);
    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      username: handle,
      display_name: displayName.trim(),
    });
    setBusy(false);
    if (insertError) {
      setError(
        insertError.code === "23505" ? "Este username já está em uso." : insertError.message,
      );
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile", "me", userId] });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <form onSubmit={create} className="evo-surface w-full max-w-sm space-y-4 p-6" noValidate>
        <h1 className="text-lg font-semibold">Crie seu perfil</h1>
        <div className="space-y-2">
          <Label htmlFor="bootstrap-name">Nome</Label>
          <Input
            id="bootstrap-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bootstrap-username">Username</Label>
          <Input
            id="bootstrap-username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            maxLength={24}
            placeholder="seu.username"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Continuar
        </Button>
      </form>
    </main>
  );
}
