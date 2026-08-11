import { Link } from "@tanstack/react-router";
import { Home, Compass, PlusCircle, MessageCircle, User } from "lucide-react";

const items = [
  { to: "/home", label: "Início", icon: Home },
  { to: "/explorar", label: "Explorar", icon: Compass },
  { to: "/criar", label: "Criar", icon: PlusCircle },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur evo-safe-bottom"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pt-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-medium transition-colors"
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
