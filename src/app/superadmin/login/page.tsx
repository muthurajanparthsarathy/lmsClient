"use client";
import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, ShieldCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showErrorToast } from "@/components/ui/toastUtils";
import { superAdminLogin } from "@/apiServices/superadmin/authService";
import { useSuperAdminAuthStore } from "@/stores/superAdminAuthStore";
import { toApiError } from "@/lib/superAdminApiClient";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const setSession = useSuperAdminAuthStore((s) => s.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: () => superAdminLogin(email.trim(), password),
    onSuccess: (res) => {
      setSession(res.token, res.superAdmin);
      router.push("/superadmin/dashboard");
    },
    onError: (err) => showErrorToast(toApiError(err).message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showErrorToast("Email and password are required");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Branded ambient backdrop — clearly the console, not the LMS */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-sidebar/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Super Admin Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">Platform owner access only</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sa-email">Email</Label>
              <Input
                id="sa-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@platform.com"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sa-password">Password</Label>
              <div className="relative">
                <Input
                  id="sa-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Secured platform console · isolated from tenant access
        </p>
      </div>
    </div>
  );
}
