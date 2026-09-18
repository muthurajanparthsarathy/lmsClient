import { useQuery } from "@tanstack/react-query";
import { useClients } from "@/app/lms/pages/clientmanagement/api/clientManagementService";
import { useServiceMappings } from "@/app/lms/pages/servicemapping/api/serviceMappingService";
import { degreeService } from "@/app/lms/pages/dynamicfieldsettings/api/degreeService";

// ─────────────────────────────────────────────────────────────────────────────
// Institution reference lists (clients, service mappings, degrees) for the
// user-management modals.
//
// Three modals used to fetch these with raw effects into local useState on
// EVERY open — UserModals, BulkUserModal and BulkUploadModal each kept their
// own copy. These wrappers give them shared cache entries, gated on the
// modal's open flag.
//
// Clients and service mappings ride the services' OWN query keys
// (clientManagementKeys.lists() / serviceMappingKeys.lists()) — that is what
// wires them into the Business Management mutations' invalidations, so a
// client created there appears in the Add User dropdown immediately. Do NOT
// re-key these under new roots: nothing would invalidate them.
//
// staleTime 0 everywhere: each modal open revalidates (the pre-refactor
// behavior was a fresh fetch per open), but concurrent readers share one
// request and reopenings paint instantly from cache while revalidating.
// ─────────────────────────────────────────────────────────────────────────────

export const useClientsQuery = (enabled: boolean) =>
  useClients({
    enabled: enabled && typeof window !== "undefined",
    staleTime: 0,
  });

export const useServiceMappingsQuery = (enabled: boolean) =>
  useServiceMappings({
    enabled: enabled && typeof window !== "undefined",
    staleTime: 0,
  });

// Shares the ['degrees'] key with the service-mapping wizard; the Degree
// Management screen invalidates that prefix after each mutation, so per-open
// revalidation is no longer the only freshness lever.
//
// staleTime defaults to 0 (revalidate every open) for these modals. The
// Degree Management tab itself passes a longer staleTime — it's a
// persistent page, not a reopen-per-action modal, so it wants real caching
// (skip the network call on same-session tab revisits) rather than an
// always-fresh guarantee.
export const useDegreesQuery = (enabled: boolean, staleTime: number = 0) =>
  useQuery({
    queryKey: ['degrees'],
    queryFn: async () => (await degreeService.getAllDegrees())?.degrees ?? [],
    enabled: enabled && typeof window !== "undefined",
    staleTime,
  });
