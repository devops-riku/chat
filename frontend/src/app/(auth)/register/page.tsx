"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  username: "Username",
  display_name: "Display name",
  password: "Password",
};

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({
    email: "",
    username: "",
    display_name: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      router.push("/chat");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4 py-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-900/40">
            C
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Create account</h1>
          <p className="mt-1 text-sm text-zinc-500">Join Chat — it&apos;s free</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {(["email", "username", "display_name", "password"] as const).map((field) => (
            <div key={field}>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                {FIELD_LABELS[field]}
              </label>
              <Input
                type={field === "password" ? "password" : field === "email" ? "email" : "text"}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                placeholder={
                  field === "email" ? "you@example.com"
                  : field === "username" ? "yourhandle"
                  : field === "display_name" ? "Your Name"
                  : "••••••••"
                }
                required
              />
            </div>
          ))}
          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
