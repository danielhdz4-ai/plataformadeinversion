"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();
  const next = params.get("next") ?? "/app/scan/nuevo";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setLoading(false);
    if (error) setMessage(error.message);
    else setMessage("Revisa tu email para el enlace de acceso.");
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-md flex-col gap-4 px-6 py-20">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <input
        type="email"
        required
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-3"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-emerald-500 py-3 font-medium text-slate-950 disabled:opacity-50"
      >
        {loading ? "Enviando…" : "Magic link"}
      </button>
      {message && <p className="text-sm text-slate-300">{message}</p>}
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
