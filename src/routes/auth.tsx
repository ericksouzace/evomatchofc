import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EvoLogo } from "@/components/evo/EvoLogo";
import { isUsernameAvailable } from "@/lib/evo/profile";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["login", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar no EvoMatch" },
      {
        name: "description",
        content:
          "Acesse sua conta EvoMatch ou crie um perfil para encontrar parceiros de treino, profissionais e eventos esportivos.",
      },
      { property: "og:title", content: "Entrar no EvoMatch" },
      {
        property: "og:description",
        content: "Acesse sua conta EvoMatch ou crie seu perfil esportivo.",
      },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Informe um e-mail válido.").max(255);
const passwordSchema = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.");

function safeRedirect(value: string | undefined) {
  if (!value) return "/home";
  if (!value.startsWith("/") || value.startsWith("//")) return "/home";
  return value;
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [busy, setBusy] = useState<null | "email" | "google" | "apple">(null);
  const [emailSent, setEmailSent] = useState<null | "confirm" | "reset">(null);
  const [formError, setFormError] = useState<string | null>(null);

  const destination = safeRedirect(search.redirect);

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setFormError(parsedEmail.error.issues[0]!.message);
      return;
    }

    if (mode === "forgot") {
      setBusy("email");
      const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(null);
      if (error) {
        setFormError(error.message);
        return;
      }
      setEmailSent("reset");
      return;
    }

    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) {
      setFormError(parsedPassword.error.issues[0]!.message);
      return;
    }

    if (mode === "login") {
      setBusy("email");
      const { error } = await supabase.auth.signInWithPassword({
        email: parsedEmail.data,
        password: parsedPassword.data,
      });
      setBusy(null);
      if (error) {
        setFormError(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message,
        );
        return;
      }
      if (!keepSignedIn) {
        window.sessionStorage.setItem("evomatch.signout-on-close", "1");
      } else {
        window.sessionStorage.removeItem("evomatch.signout-on-close");
      }
      void navigate({ to: destination, replace: true });
      return;
    }

    // signup
    const name = displayName.trim();
    if (name.length < 2 || name.length > 60) {
      setFormError("Informe seu nome (2 a 60 caracteres).");
      return;
    }
    const handle = username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,24}$/.test(handle)) {
      setFormError("Username: 3 a 24 caracteres, apenas letras, números, ponto ou underline.");
      return;
    }

    setBusy("email");
    try {
      const available = await isUsernameAvailable(handle);
      if (!available) {
        setBusy(null);
        setFormError("Este username já está em uso ou é reservado.");
        return;
      }
    } catch {
      setBusy(null);
      setFormError("Não foi possível validar o username agora. Tente novamente.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: parsedEmail.data,
      password: parsedPassword.data,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name, username: handle },
      },
    });
    setBusy(null);

    if (error) {
      setFormError(
        error.message.includes("already registered")
          ? "Já existe uma conta com este e-mail."
          : error.message,
      );
      return;
    }

    if (!data.session) {
      setEmailSent("confirm");
      return;
    }

    // Sessão imediata: cria o perfil real antes de seguir para o onboarding.
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user!.id,
      username: handle,
      display_name: name,
    });
    if (profileError && profileError.code !== "23505") {
      toast.error("Conta criada, mas o perfil falhou: " + profileError.message);
    }
    void navigate({ to: "/onboarding", replace: true });
  }

  async function handleOAuth(provider: "google" | "apple") {
    setFormError(null);
    setBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setBusy(null);
        setFormError(
          "Não foi possível entrar com " +
            (provider === "google" ? "Google" : "Apple") +
            ". Tente novamente.",
        );
        return;
      }
      if (result.redirected) return;
      void navigate({ to: destination, replace: true });
    } catch {
      setBusy(null);
      setFormError("Falha inesperada no login social.");
    }
  }

  if (emailSent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="evo-surface w-full max-w-sm p-6 text-center">
          <Mail className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-lg font-semibold">Verifique seu e-mail</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {emailSent === "confirm"
              ? "Enviamos um link de confirmação para " + email + ". Confirme para ativar sua conta."
              : "Enviamos um link de redefinição de senha para " + email + "."}
          </p>
          <Button
            variant="secondary"
            className="mt-6 w-full"
            onClick={() => {
              setEmailSent(null);
              setMode("login");
            }}
          >
            Voltar para o login
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background px-6 pb-10 evo-safe-top">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <EvoLogo className="h-14 w-14" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            {mode === "login" ? "Entrar no EvoMatch" : null}
            {mode === "signup" ? "Criar conta" : null}
            {mode === "forgot" ? "Recuperar senha" : null}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "Enviaremos um link para você definir uma nova senha."
              : "Evolua com quem treina com você."}
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
          {mode === "signup" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="displayName">Nome</Label>
                <Input
                  id="displayName"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Como você quer ser chamado"
                  maxLength={60}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoCapitalize="none"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="seu.username"
                  maxLength={24}
                />
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </div>

          {mode !== "forgot" ? (
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : null}

          {mode === "login" ? (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={keepSignedIn}
                  onCheckedChange={(v) => setKeepSignedIn(v === true)}
                />
                Manter conectado
              </label>
              <button
                type="button"
                className="text-sm font-medium text-primary"
                onClick={() => {
                  setMode("forgot");
                  setFormError(null);
                }}
              >
                Esqueci a senha
              </button>
            </div>
          ) : null}

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy !== null}>
            {busy === "email" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "login" ? "Entrar" : null}
            {mode === "signup" ? "Criar conta" : null}
            {mode === "forgot" ? "Enviar link" : null}
          </Button>
        </form>

        {mode !== "forgot" ? (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou continue com
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={busy !== null}
                onClick={() => handleOAuth("google")}
              >
                {busy === "google" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continuar com Google
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={busy !== null}
                onClick={() => handleOAuth("apple")}
              >
                {busy === "apple" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continuar com Apple
              </Button>
            </div>
          </>
        ) : null}

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Ainda não tem conta?{" "}
              <button
                className="font-semibold text-primary"
                onClick={() => {
                  setMode("signup");
                  setFormError(null);
                }}
              >
                Criar conta
              </button>
            </>
          ) : (
            <button
              className="inline-flex items-center gap-1 font-semibold text-primary"
              onClick={() => {
                setMode("login");
                setFormError(null);
              }}
            >
              <ArrowLeft className="h-4 w-4" /> Voltar para o login
            </button>
          )}
        </div>

      </div>
    </main>
  );
}
