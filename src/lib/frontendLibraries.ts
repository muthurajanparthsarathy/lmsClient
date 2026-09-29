// Frontend libraries a topic's Skill Set can switch on for the HTML/CSS/JS
// compilers. When a library is enabled (e.g. "bootstrap" in the exercise's
// selectedLanguages), it is loaded into the preview automatically, so students
// can use its classes without writing any <link>/<script> tags. The student
// compilers and the staff review preview both go through
// applyFrontendLibraries(), so staff see exactly what students saw.

const BOOTSTRAP_VERSION = '5.3.3';
const BOOTSTRAP_CSS = `https://cdn.jsdelivr.net/npm/bootstrap@${BOOTSTRAP_VERSION}/dist/css/bootstrap.min.css`;
const BOOTSTRAP_JS = `https://cdn.jsdelivr.net/npm/bootstrap@${BOOTSTRAP_VERSION}/dist/js/bootstrap.bundle.min.js`;

export const BOOTSTRAP_LABEL = 'Bootstrap 5.3';

export interface FrontendLibraries {
  bootstrap: boolean;
}

/**
 * Which libraries are switched on. Pass every place the exercise may keep its
 * languages — the You Do assessment form saves them under
 * exerciseInformation.selectedLanguages, older flows under
 * programmingSettings.selectedLanguages.
 */
export const isBootstrapEnabled = (...languageLists: unknown[]): boolean =>
  languageLists.some(
    list => Array.isArray(list) && list.some(l => String(l).toLowerCase().trim() === 'bootstrap')
  );

/**
 * Returns `html` with the enabled libraries' tags inserted right after <head>.
 * They go first so the student's own CSS/JS (which the preview puts later in the
 * document) loads after them and wins on equal specificity. A library the
 * student already linked by hand is skipped — loading bootstrap.bundle.js twice
 * registers every data-bs-* handler twice (dropdowns open and close at once).
 */
export function applyFrontendLibraries(html: string, libs: FrontendLibraries): string {
  if (!html || !libs.bootstrap) return html;

  const tags: string[] = [];
  if (!/bootstrap(\.min)?\.css/i.test(html)) {
    tags.push(`<link rel="stylesheet" href="${BOOTSTRAP_CSS}">`);
  }
  if (!/bootstrap(\.bundle)?(\.min)?\.js/i.test(html)) {
    tags.push(`<script src="${BOOTSTRAP_JS}"></script>`);
  }
  if (tags.length === 0) return html;

  const injected = tags.join('\n');
  // (\s[^>]*)? so <header> is never mistaken for <head>
  const headOpen = /<head(\s[^>]*)?>/i;
  return headOpen.test(html)
    ? html.replace(headOpen, m => `${m}\n${injected}`)
    : `${injected}\n${html}`;
}
