'use client';

/**
 * External → Event — placeholder.
 *
 * The permission (`admin-external-event` / key `externalevent`) and the route
 * exist now so the module can be granted and the rail entry appears; the
 * screen itself is deliberately empty until the Event feature is specified.
 *
 * Rendered inside the admin DashboardLayout, matching every other admin
 * screen — Course Setup, User Management, Grades — so the shell (sidebar,
 * workspace panel, canvas) is identical and the placeholder does not read as
 * a broken page.
 */

import { motion } from 'framer-motion';
import { CalendarDays, Sparkles } from 'lucide-react';
import DashboardLayout from '@/app/lms/component/layout';
import { pageEnter } from '@/app/lms/shared/ui';

export default function ExternalEventPage() {
  return (
    <DashboardLayout>
      <div className="min-h-full h-full flex flex-col">
        <motion.div
          variants={pageEnter}
          initial="hidden"
          animate="visible"
          className="flex flex-1 min-h-0 flex-col px-4 sm:px-6 lg:px-8 pt-3 pb-3 text-body"
        >
          {/* Heading — same slim scale as the other admin pages so this reads
              as a real screen that has not shipped yet, rather than an error. */}
          <header className="shrink-0">
            <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em] leading-tight">
              Event
            </h1>
            <p className="mt-0.5 text-xs text-subtle">
              External events — registration, scheduling and attendance.
            </p>
          </header>

          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="flex flex-col items-center text-center max-w-sm py-16">
              <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-wash text-brand-strong">
                <CalendarDays className="h-7 w-7" />
                <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-brand-strong" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-heading">Coming Soon</h2>
              <p className="mt-1.5 text-sm text-subtle">
                External event management is not available yet. This page is
                reserved for it — you can already grant the permission so the
                team sees it the day it ships.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
