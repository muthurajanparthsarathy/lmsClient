// Sites that send X-Frame-Options / CSP frame-ancestors and therefore REFUSE
// to render inside an iframe. The refusal happens in the browser and is not
// detectable from JS (onError never fires, contentDocument throws), so the
// only way to give these a decent UX is to know them up front and skip the
// doomed iframe. Extend the list as teachers report new "refused to connect"
// sites.
export const FRAME_BLOCKED_HOSTS = [
  'leetcode.com',
  'hackerrank.com',
  'codeforces.com',
  'codechef.com',
  'geeksforgeeks.org',
  'github.com',
  'codingninjas.com',
  'naukri.com', // Coding Ninjas Studio moved here
];

/** True when the URL's host is known to refuse iframe embedding. */
export function isFrameBlocked(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return FRAME_BLOCKED_HOSTS.some((d) => h === d || h.endsWith('.' + d));
  } catch {
    return false;
  }
}

/** Display host for messaging, e.g. "leetcode.com". */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
