// Main pages that use DashboardLayout. Course players and role-specific
// consoles outside this set continue to own their layouts.
const DASHBOARD_SECTIONS = [
  'admindashboard', 'usermanagement', 'clientmanagement', 'servicemapping',
  'businessmanagement', 'approvals', 'attendancemanagement', 'calendar',
  'questionbanks', 'dynamicfieldsettings', 'logs', 'profile', 'notifications',
  'grades', 'instutionmanagement', 'programcalender', 'pedagogy', 'poc',
  'coursestructure/course-batches', 'coursestructure/course-sections',
  'coursestructure/course-participants', 'coursestructure/feedback',
  'coursestructure/programcalendar', 'coursestructure/pedagogy2',
  'coursestructure/view-resources',
];
const DASHBOARD_PAGES = [
  '/lms/pages/coursestructure', '/lms/pages/reports/performance',
  '/lms/pages/external/assessment', '/lms/pages/external/event',
];

export function isPersistentDashboardRoute(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0].replace(/\/$/, '');
  return DASHBOARD_PAGES.includes(path) || DASHBOARD_SECTIONS.some((section) => {
    const prefix = `/lms/pages/${section}`;
    return path === prefix || path.startsWith(prefix + '/');
  });
}

export function usesPersistentDashboardRole(role: string): boolean {
  // Match the canonical role values used by pages that select this shell.
  return ['admin', 'programcoordinator'].includes(
    role.toLowerCase().replace(/[^a-z]/g, ''),
  );
}
