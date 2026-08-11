import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EvoLogo } from "@/components/evo/EvoLogo";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "EvoMatch — evolua com quem treina com você" },
      {
        name: "description",
        content:
          "Entre no EvoMatch: encontre parceiros de treino, academias, profissionais, eventos e comunidades esportivas perto de você.",
      },
      { property: "og:title", content: "EvoMatch — evolua com quem treina com você" },
      {
        property: "og:description",
        content:
          "Encontre parceiros de treino, academias, profissionais, eventos e comunidades esportivas perto de você.",
      },
    ],
  }),
  component: Splash,
});

/** Splash canônico: verifica sessão real e encaminha para autenticação ou app. */
function Splash() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const start = Date.now();

    (async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError("Não foi possível verificar sua sessão.");
        return;
      }
      const wait = Math.max(0, 900 - (Date.now() - start));
      setTimeout(() => {
        if (!active) return;
        void navigate({ to: data.session ? "/app/home" : "/auth", replace: true });
      }, wait);
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-primary/25 evo-pulse" aria-hidden />
        <EvoLogo className="relative h-20 w-20" />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">EvoMatch</h1>
        <p className="mt-1 text-sm text-muted-foreground">Evolua. Conecte. Treine.</p>
      </div>
      {error ? (
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}
    </main>
  );
}
