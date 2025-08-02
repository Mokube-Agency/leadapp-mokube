import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import dayjs from "dayjs";

export default function EmailPage() {
  const { user } = useAuth();
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState(null);

  // Fallback-fetch bij mount
  useEffect(() => {
    if (!user) return;
    
    (async () => {
      const { data, error } = await supabase
        .from("email_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("received_at", { ascending: false });
      console.log("Fetched emails:", data, "Error:", error);
      if (error) setError(error.message);
      else setEmails(data);
    })();
  }, [user]);

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
        {emails.map(e => (
          <li key={e.id} className="border-b pb-2">
            <div className="flex justify-between">
              <span className="font-semibold">{e.subject || "(Geen onderwerp)"}</span>
              <span className="text-sm text-gray-500">{dayjs(e.received_at).format("DD MMM YYYY HH:mm")}</span>
            </div>
            <div className="text-sm text-gray-700 mt-1">
              <strong>Van:</strong> {e.from_address}
              <br />
              <strong>Aan:</strong> {e.to_address}
            </div>
            <div className="mt-2 text-sm">{e.body}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}