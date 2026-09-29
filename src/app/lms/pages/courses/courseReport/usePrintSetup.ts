"use client";

import { useEffect, useMemo, useState } from "react";
import {
  activeFormat, fetchReportSettings, newFormat,
  type ReportFormat, type ReportSettings,
} from "@/app/lms/pages/reportsettings/api/reportSettingsService";
import { BRAND_FALLBACK } from "@/app/lms/pages/reportsettings/api/brand";
import { fetchInstitutionById } from "@/app/lms/pages/instutionmanagement/api/institutionService";

/** The saved report design and the institution's letterhead wording — the
 *  same pair the Program Calendar and Course Setup reports load. One fetch per
 *  mount, and a silent fall-back to the built-in layout and brand wording, so a
 *  missing setting can never block a printout. */
export function usePrintSetup() {
  const [reportSettings, setReportSettings] = useState<ReportSettings | undefined>();
  const [letterhead, setLetterhead] = useState<{ org: string; address: string; contact: string }>(BRAND_FALLBACK);

  useEffect(() => {
    const institutionId = typeof window === "undefined" ? null : localStorage.getItem("smartcliff_institution");
    if (!institutionId) return;
    let cancelled = false;
    fetchReportSettings(institutionId)
      .then((settings) => { if (!cancelled) setReportSettings(settings); })
      .catch(() => { /* plain layout */ });
    fetchInstitutionById(institutionId)
      .then((institution) => {
        if (cancelled) return;
        setLetterhead({
          org: institution?.inst_name?.trim() || BRAND_FALLBACK.org,
          address: institution?.address?.trim() || "",
          contact: institution?.phone?.trim() || "",
        });
      })
      .catch(() => { /* fallback wording */ });
    return () => { cancelled = true; };
  }, []);

  const initialFormat: ReportFormat = useMemo(
    () => activeFormat(reportSettings) ?? newFormat("Report layout", false),
    [reportSettings],
  );

  return { letterhead, initialFormat };
}
