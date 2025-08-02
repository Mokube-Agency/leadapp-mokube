import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Chat from "./pages/Chat";
import ContactsPage from "./pages/ContactsPage";
import AgentPage from "./pages/AgentPage";
import CalendarPage from "./pages/CalendarPage";
import EmailPage from "./pages/EmailPage";
import SettingsPage from "./pages/SettingsPage";
import OrganizationPage from "./pages/OrganizationPage";
import NotFound from "./pages/NotFound";
import AppShell from "./layouts/AppShell";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { AuthPage } from "@/components/auth/AuthPage";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/chats" replace />} />
        <Route path="chats" element={<Chat />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="agent" element={<AgentPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="emails" element={<EmailPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AuthenticatedApp />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
