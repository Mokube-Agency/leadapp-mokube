import { Link, Outlet, useLocation } from "react-router-dom";
import { MessageCircle, Users, Bot, Calendar, Settings } from "lucide-react";

export default function AppShell() {
  const { pathname } = useLocation();
  
  const nav = [
    { href: "/chats", label: "Chats", icon: MessageCircle },
    { href: "/contacts", label: "Contacten", icon: Users },
    { href: "/agent", label: "AI-agent", icon: Bot },
    { href: "/calendar", label: "Kalender", icon: Calendar },
  ];

  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r bg-background p-4 flex flex-col gap-2">
        <h1 className="text-xl font-semibold mb-4 text-primary">Leadapp</h1>
        {nav.map(n => {
          const Icon = n.icon;
          const isActive = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              to={n.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors ${
                isActive ? "bg-muted font-medium text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
        
        <div className="mt-auto space-y-2">
          <Link
            to="/settings"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors ${
              pathname === '/settings' ? "bg-muted font-medium text-primary" : "text-muted-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            Instellingen
          </Link>
          <div className="text-sm text-muted-foreground px-3">v0.1.0</div>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
}