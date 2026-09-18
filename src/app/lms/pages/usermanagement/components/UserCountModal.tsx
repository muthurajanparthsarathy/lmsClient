"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Users } from "lucide-react";
import type { UserRoleCounts } from "@/queries/userRoleCounts";

/**
 * The breakdown behind the user-count button: how many users hold each role.
 *
 * Counts arrive already grouped and sorted from the server, so this renders
 * them and nothing else — it never sees a user document. The figures are
 * institution-wide, not a readout of the table's current filters, which is why
 * the description says so out loud: a reader who has just filtered the table
 * to twelve rows needs to know why this says two hundred.
 */
export const UserCountModal = ({
  isOpen,
  onClose,
  data,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  data?: UserRoleCounts;
  isLoading: boolean;
}) => {
  const roles = data?.roles ?? [];
  const total = data?.total ?? 0;
  // Bar widths are relative to the LARGEST bucket, not to the total: with one
  // role holding most of the directory, total-relative bars leave every other
  // row a hairline and the comparison they exist for is lost.
  const largest = roles.reduce((max, r) => Math.max(max, r.count), 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-wash text-brand-strong">
              <Users className="size-4" />
            </span>
            Users by role
          </DialogTitle>
          <DialogDescription>
            Every user in this institution, whatever the table is filtered to.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-subtle">
            <Loader2 className="size-4 animate-spin" /> Counting users…
          </div>
        ) : roles.length === 0 ? (
          <p className="py-10 text-center text-sm text-subtle">No users yet.</p>
        ) : (
          <ul className="max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
            {roles.map((role) => (
              <li key={role.roleId || role.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-heading">{role.name}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-heading">{role.count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${largest ? (role.count / largest) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-1 flex items-center justify-between border-t border-hairline pt-3">
          <span className="text-sm font-semibold text-subtle">Total</span>
          <span className="text-sm font-bold tabular-nums text-heading">{total}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
