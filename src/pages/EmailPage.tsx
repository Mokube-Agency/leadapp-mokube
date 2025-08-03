import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import dayjs from "dayjs";

export default function EmailPage() {
  const { user } = useAuth();
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState(null);

  // ---------- fetch via Nylas list-emails Function ----------
  useEffect(() => {
    if (!user) return;
    
    (async () => {
      try {
        console.log("🔴 [EmailPage] Calling list-emails with user_id:", user.id);
        
        const response = await supabase.functions.invoke('list-emails', {
          body: { user_id: user.id }
        });
        
        console.log("🔴 [EmailPage] Response received:", response);
        
        if (response.error) {
          console.error("🔴 [EmailPage] Edge function error:", response.error);
          setError(`Fout bij ophalen e-mails: ${response.error.message || response.error}`);
          return;
        }
        
        console.log("✅ [EmailPage] Nylas emails:", response.data);
        setEmails(response.data || []);
      } catch (e) {
        console.error("🔴 [EmailPage] Fetch failed:", e);
        setError(`Fout bij ophalen e-mails: ${e.message}`);
      }
    })();
  }, [user, supabase]);

  if (error) {
    return <div className="p-6 text-red-600">Fout: {error}</div>;
  }
  if (!emails.length) {
    return <div className="p-6">Geen e-mailberichten gevonden.</div>;
  }

  return (
    <div className="p-6 overflow-auto h-full">
      <h1 className="text-2xl font-bold mb-4">E-mailberichten</h1>
      <ul className="space-y-4">
        {emails.map((email, index) => {
          // Handle both Gmail API format and legacy format
          const subject = email.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || email.subject || "(Geen onderwerp)";
          const fromHeader = email.payload?.headers?.find((h: any) => h.name === 'From')?.value || email.from?.[0]?.email || "Onbekend";
          const toHeader = email.payload?.headers?.find((h: any) => h.name === 'To')?.value || email.to?.[0]?.email || "Onbekend";
          const dateHeader = email.payload?.headers?.find((h: any) => h.name === 'Date')?.value;
          const snippet = email.snippet || email.body || "Geen inhoud beschikbaar";
          
          return (
            <li key={email.id || index} className="border-b pb-2">
              <div className="flex justify-between">
                <span className="font-semibold">{subject}</span>
                <span className="text-sm text-gray-500">
                  {dateHeader ? dayjs(dateHeader).format("DD MMM YYYY HH:mm") : 
                   email.date ? dayjs(email.date * 1000).format("DD MMM YYYY HH:mm") : "Onbekende datum"}
                </span>
              </div>
              <div className="text-sm text-gray-700 mt-1">
                <strong>Van:</strong> {fromHeader}
                <br />
                <strong>Aan:</strong> {toHeader}
              </div>
              <div className="mt-2 text-sm">
                {snippet}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}