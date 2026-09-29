'use client';
import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// The per-client pages (Roles / Users / Resources) are reached from the Client
// list's 3-dot menu, which passes ?institution=<id>&name=<name>. When scoped,
// the page preselects that client and hides its institution dropdown. When
// visited directly (no param) the page falls back to its own dropdown.
export function useClientScope() {
  const params = useSearchParams();
  const institutionId = params.get('institution') || '';
  const name = params.get('name') || '';
  return { institutionId, name, scoped: !!institutionId };
}

export function BackToClients({ name }: { name?: string }) {
  return (
    <div className="mb-4 flex items-center gap-1.5 text-sm">
      <Link
        href="/superadmin/clients"
        className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </Link>
      {name && (
        <span className="text-muted-foreground">
          / <span className="font-medium text-foreground">{name}</span>
        </span>
      )}
    </div>
  );
}
