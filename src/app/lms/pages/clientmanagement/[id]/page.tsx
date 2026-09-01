// Route entry for /lms/pages/clientmanagement/<id> — thin wrapper over the
// feature module. Added 2026-08-30 so "View details" from the client list
// can navigate to a full page (matches the SaaS-details mockup) instead of
// only opening the right-side drawer.
export { default } from "@/features/clientmanagement/ClientDetailsPage";
