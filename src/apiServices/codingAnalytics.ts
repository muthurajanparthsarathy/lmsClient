// ─────────────────────────────────────────────────────────────────────────────
// Coding Analytics — five platform adapters, ONE normalized report shape.
//
// The dashboard renders PlatformReport and nothing else; every adapter maps
// its platform's raw data into it. Sections whose field is null are hidden by
// the UI (capability-driven), so the layout stays identical across platforms
// while labels/metrics adapt.
//
// Sources (probed live 2026-08-11):
//   leetcode   → our server proxy /coding-analytics/leetcode/:u
//                (leetcode.com/graphql server-side — the free public proxy
//                 API rate-limits; direct GraphQL doesn't)
//   codeforces → official public API, CORS-open → called directly
//   codechef   → our server proxy (profile-page scrape; community API is 402)
//   hackerrank → our server proxy (badges + scores REST; profile 404s)
//   atcoder    → our server proxy (kenkoooo Problems API + history JSON)
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';

export type PlatformKey = 'leetcode' | 'codeforces' | 'codechef' | 'hackerrank' | 'atcoder';

// ── VERIFICATION-PHASE ACCOUNTS (hardcoded on purpose) ──────────────────────
// Phase 2 replaces this with the per-student store the 13.07 snapshot already
// had (/user/coding-platforms + Settings UI). Public handles only — no keys.
export const CODING_ACCOUNTS: Partial<Record<PlatformKey, string>> = {
  leetcode: 'MUTHURAJANP15112000',
  codeforces: 'muthurajanparthasarathy',
  codechef: 'plague_case_19',
  hackerrank: 'muthurajanparth1',
  atcoder: 'muthurajan',
};

export const PLATFORM_META: Record<PlatformKey, { name: string; color: string; profileUrl: (u: string) => string }> = {
  leetcode: { name: 'LeetCode', color: '#FFA116', profileUrl: (u) => `https://leetcode.com/u/${u}/` },
  codeforces: { name: 'Codeforces', color: '#3B82F6', profileUrl: (u) => `https://codeforces.com/profile/${u}` },
  codechef: { name: 'CodeChef', color: '#7B5E47', profileUrl: (u) => `https://www.codechef.com/users/${u}` },
  hackerrank: { name: 'HackerRank', color: '#00B8A3', profileUrl: (u) => `https://www.hackerrank.com/profile/${u}` },
  atcoder: { name: 'AtCoder', color: '#475569', profileUrl: (u) => `https://atcoder.jp/users/${u}` },
};

export interface Metric { key: string; label: string; value: string; sub?: string }
export interface SeriesPoint { day: string; count: number }                    // day = YYYY-MM-DD
export interface TopicStat { name: string; solved: number }
export type Verdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE' | 'OTHER';
export interface RecentSub { title: string; url?: string; difficulty?: string; lang: string; verdict: Verdict; verdictLabel: string; when: number }
export interface SolvedRow { n: number; title: string; difficulty?: string; topic?: string; lang?: string; when?: number; url?: string }
export interface ContestInfo {
  rating: number | null; maxRating: number | null; count: number;
  bestRank: number | null; history: { label: string; rating: number; t: number }[];
}
export interface PlatformReport {
  platform: PlatformKey;
  username: string; displayName: string; avatar?: string; profileUrl: string;
  metrics: Metric[];
  activity: SeriesPoint[] | null;
  difficulty: { easy: number; medium: number; hard: number } | null;
  topics: TopicStat[] | null;
  recent: RecentSub[] | null;
  solved: SolvedRow[] | null;
  contest: ContestInfo | null;
  fetchedAt: number;
}

const authHeaders = (): Record<string, string> => {
  const t = typeof window !== 'undefined'
    ? localStorage.getItem('smartcliff_token') || localStorage.getItem('token') || ''
    : '';
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const getJson = async (url: string, external = false): Promise<any> => {
  const res = await fetch(url, external ? undefined : { headers: authHeaders() });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; if (j?.comment) msg = j.comment; } catch { /* keep */ }
    throw new Error(msg);
  }
  return res.json();
};

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
// en-US grouping (2,028,209) — the lakh-style en-IN grouping read oddly on a
// developer-tool dashboard.
const nf = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('en-US'));

// ── LeetCode ────────────────────────────────────────────────────────────────

const leetcodeAdapter = async (username: string): Promise<PlatformReport> => {
  const d = await getJson(`${API_BASE}/coding-analytics/leetcode/${encodeURIComponent(username)}`);
  const mu = d.matchedUser;
  const acArr: any[] = mu.submitStats?.acSubmissionNum || [];
  const totArr: any[] = mu.submitStats?.totalSubmissionNum || [];
  const ac = (diff: string) => acArr.find((x) => x.difficulty === diff) || { count: 0, submissions: 0 };
  const tot = (diff: string) => totArr.find((x) => x.difficulty === diff) || { count: 0, submissions: 0 };
  const allQ = (diff: string) => Number((d.allQuestionsCount || []).find((x: any) => x.difficulty === diff)?.count) || 0;
  const totalSubs = tot('All').submissions;
  const acSubs = ac('All').submissions;
  const acceptance = totalSubs > 0 ? Math.round((acSubs / totalSubs) * 1000) / 10 : 0;

  // Activity: submissionCalendar is a stringified { unixDaySec: count } map.
  let activity: SeriesPoint[] | null = null;
  try {
    let cal = mu.userCalendar?.submissionCalendar;
    if (typeof cal === 'string') cal = JSON.parse(cal);
    if (cal && typeof cal === 'object') {
      activity = Object.entries(cal)
        .map(([sec, count]) => ({ day: dayKey(Number(sec) * 1000), count: Number(count) || 0 }))
        .sort((a, b) => a.day.localeCompare(b.day));
    }
  } catch { activity = null; }

  const tags = [
    ...(mu.tagProblemCounts?.fundamental || []),
    ...(mu.tagProblemCounts?.intermediate || []),
    ...(mu.tagProblemCounts?.advanced || []),
  ]
    .filter((t: any) => Number(t.problemsSolved) > 0)
    .sort((a: any, b: any) => b.problemsSolved - a.problemsSolved)
    .slice(0, 10)
    .map((t: any) => ({ name: t.tagName, solved: Number(t.problemsSolved) }));

  const recent: RecentSub[] = (d.recentAcSubmissionList || []).map((s: any) => ({
    title: s.title,
    url: `https://leetcode.com/problems/${s.titleSlug}/`,
    lang: s.lang,
    verdict: 'AC' as Verdict,
    verdictLabel: 'Accepted',
    when: Number(s.timestamp) * 1000,
  }));

  const cr = d.userContestRanking;
  return {
    platform: 'leetcode',
    username,
    displayName: mu.profile?.realName || username,
    avatar: mu.profile?.userAvatar,
    profileUrl: PLATFORM_META.leetcode.profileUrl(username),
    metrics: [
      // The E/M/H split lives in the Difficulty Distribution donut — a
      // three-numbers-in-one-card metric read as clutter.
      { key: 'solved', label: 'Problems Solved', value: nf(ac('All').count), sub: `of ${nf(allQ('All'))}` },
      { key: 'subs', label: 'Total Submissions', value: nf(totalSubs), sub: `${nf(acSubs)} accepted` },
      { key: 'acceptance', label: 'Acceptance Rate', value: `${acceptance}%` },
      { key: 'rating', label: 'Contest Rating', value: cr?.rating ? String(Math.round(cr.rating)) : '—', sub: cr?.attendedContestsCount ? `${cr.attendedContestsCount} contests` : 'no contests yet' },
      { key: 'ranking', label: 'Global Ranking', value: mu.profile?.ranking ? `#${nf(mu.profile.ranking)}` : '—' },
      { key: 'active', label: 'Active Days (1y)', value: nf(mu.userCalendar?.totalActiveDays ?? null), sub: mu.userCalendar?.streak ? `max streak ${mu.userCalendar.streak}` : undefined },
    ],
    activity,
    difficulty: { easy: ac('Easy').count, medium: ac('Medium').count, hard: ac('Hard').count },
    topics: tags.length ? tags : null,
    recent: recent.length ? recent : [],
    solved: recent.map((r, i) => ({ n: i + 1, title: r.title, lang: r.lang, when: r.when, url: r.url })),
    contest: cr
      ? { rating: cr.rating ? Math.round(cr.rating) : null, maxRating: null, count: cr.attendedContestsCount || 0, bestRank: cr.globalRanking || null, history: [] }
      : null,
    fetchedAt: Date.now(),
  };
};

// ── Codeforces (browser-direct, official API) ───────────────────────────────

const CF_VERDICTS: Record<string, [Verdict, string]> = {
  OK: ['AC', 'Accepted'],
  WRONG_ANSWER: ['WA', 'Wrong Answer'],
  TIME_LIMIT_EXCEEDED: ['TLE', 'Time Limit'],
  RUNTIME_ERROR: ['RE', 'Runtime Error'],
  COMPILATION_ERROR: ['CE', 'Compilation Error'],
};

const cfDifficulty = (r?: number) => (r === undefined ? undefined : r < 1200 ? 'Easy' : r < 1800 ? 'Medium' : 'Hard');

const codeforcesAdapter = async (handle: string): Promise<PlatformReport> => {
  const [info, rating, status] = await Promise.all([
    getJson(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`, true),
    getJson(`https://codeforces.com/api/user.rating?handle=${encodeURIComponent(handle)}`, true),
    getJson(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10000`, true),
  ]);
  const u = info.result?.[0] || {};
  const subs: any[] = status.result || [];
  const acSubs = subs.filter((s) => s.verdict === 'OK');
  const solvedMap = new Map<string, any>();
  acSubs.forEach((s) => {
    const k = `${s.problem.contestId}-${s.problem.index}`;
    if (!solvedMap.has(k)) solvedMap.set(k, s);
  });

  const activity: SeriesPoint[] = [];
  const byDay = new Map<string, number>();
  acSubs.forEach((s) => {
    const k = dayKey(s.creationTimeSeconds * 1000);
    byDay.set(k, (byDay.get(k) || 0) + 1);
  });
  Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([day, count]) => activity.push({ day, count }));

  const tagCount = new Map<string, number>();
  solvedMap.forEach((s) => (s.problem.tags || []).forEach((t: string) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
  const topics = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, solved]) => ({ name, solved }));

  const diff = { easy: 0, medium: 0, hard: 0 };
  solvedMap.forEach((s) => {
    const d = cfDifficulty(s.problem.rating);
    if (d === 'Easy') diff.easy += 1; else if (d === 'Medium') diff.medium += 1; else if (d === 'Hard') diff.hard += 1;
  });

  const recent: RecentSub[] = subs.slice(0, 15).map((s) => {
    const [v, label] = CF_VERDICTS[s.verdict] || (['OTHER', s.verdict || 'Testing'] as [Verdict, string]);
    return {
      title: `${s.problem.contestId ?? ''}${s.problem.index ?? ''}. ${s.problem.name}`,
      url: s.problem.contestId ? `https://codeforces.com/contest/${s.problem.contestId}/problem/${s.problem.index}` : undefined,
      difficulty: cfDifficulty(s.problem.rating),
      lang: s.programmingLanguage,
      verdict: v, verdictLabel: label,
      when: s.creationTimeSeconds * 1000,
    };
  });

  const history = (rating.result || []).map((c: any) => ({
    label: c.contestName, rating: c.newRating, t: c.ratingUpdateTimeSeconds * 1000,
  }));
  const bestRank = (rating.result || []).reduce((m: number | null, c: any) => (m === null || c.rank < m ? c.rank : m), null);

  // FULL solved list — the UI paginates.
  const solvedRows: SolvedRow[] = Array.from(solvedMap.values())
    .sort((a, b) => b.creationTimeSeconds - a.creationTimeSeconds)
    .map((s, i) => ({
      n: i + 1,
      title: `${s.problem.contestId ?? ''}${s.problem.index ?? ''}. ${s.problem.name}`,
      difficulty: cfDifficulty(s.problem.rating),
      topic: (s.problem.tags || [])[0],
      lang: s.programmingLanguage,
      when: s.creationTimeSeconds * 1000,
      url: s.problem.contestId ? `https://codeforces.com/contest/${s.problem.contestId}/problem/${s.problem.index}` : undefined,
    }));

  return {
    platform: 'codeforces',
    username: handle,
    displayName: [u.firstName, u.lastName].filter(Boolean).join(' ') || handle,
    avatar: u.titlePhoto,
    profileUrl: PLATFORM_META.codeforces.profileUrl(handle),
    metrics: [
      { key: 'solved', label: 'Problems Solved', value: nf(solvedMap.size) },
      { key: 'rating', label: 'Current Rating', value: u.rating ? String(u.rating) : 'Unrated', sub: u.rank || undefined },
      { key: 'max', label: 'Maximum Rating', value: u.maxRating ? String(u.maxRating) : '—', sub: u.maxRank || undefined },
      { key: 'contests', label: 'Contests', value: nf(history.length) },
      { key: 'accepted', label: 'Accepted Submissions', value: nf(acSubs.length), sub: `of ${nf(subs.length)} total` },
      { key: 'contribution', label: 'Contribution', value: String(u.contribution ?? 0) },
    ],
    activity: activity.length ? activity : [],
    difficulty: solvedMap.size ? diff : { easy: 0, medium: 0, hard: 0 },
    topics: topics.length ? topics : null,
    recent,
    solved: solvedRows,
    contest: { rating: u.rating ?? null, maxRating: u.maxRating ?? null, count: history.length, bestRank, history },
    fetchedAt: Date.now(),
  };
};

// ── CodeChef ────────────────────────────────────────────────────────────────

// CodeChef tag hygiene: profile pages tag problems with author handles
// (xyz_adm) and contest codes (START195 / COOK…), which are noise as skills.
const CC_JUNK_TAG = /_adm$|^start\d+|^cook\d+|^ltime\d+|^codechef|^\d+$/i;
const CC_DIFF_TAG: Record<string, 'easy' | 'medium' | 'hard'> = {
  cakewalk: 'easy', simple: 'easy', easy: 'easy',
  'easy-medium': 'medium', medium: 'medium',
  'medium-hard': 'hard', hard: 'hard', challenge: 'hard',
};
// "03:57 PM 06/11/25" → epoch ms (CodeChef renders DD/MM/YY).
const ccTime = (s: string): number => {
  const m = String(s).match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*(\d{2})\/(\d{2})\/(\d{2})/i);
  if (!m) return 0;
  let hh = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) hh += 12;
  return new Date(2000 + Number(m[6]), Number(m[5]) - 1, Number(m[4]), hh, Number(m[2])).getTime();
};

const codechefAdapter = async (username: string): Promise<PlatformReport> => {
  const d = await getJson(`${API_BASE}/coding-analytics/codechef/${encodeURIComponent(username)}`);
  const history = (Array.isArray(d.ratingHistory) ? d.ratingHistory : []).map((h: any) => ({
    label: h.name || h.code || 'Contest',
    rating: Number(h.rating) || 0,
    t: Date.UTC(Number(h.getyear) || 1970, (Number(h.getmonth) || 1) - 1, Number(h.getday) || 1),
  })).sort((a: any, b: any) => a.t - b.t);
  const bestRank = (Array.isArray(d.ratingHistory) ? d.ratingHistory : [])
    .reduce((m: number | null, h: any) => { const r = Number(h.rank); return Number.isFinite(r) && (m === null || r < m) ? r : m; }, null);

  // Recent submissions feed (scraped) → recent, activity, solved, topics.
  const feed: any[] = Array.isArray(d.recent) ? d.recent : [];
  const isAC = (r: any) => /accept|\(100\)/i.test(String(r.result));
  const verdictOf = (r: any): [Verdict, string] => {
    const t = String(r.result).toLowerCase();
    if (isAC(r)) return ['AC', 'Accepted'];
    if (t.includes('wrong')) return ['WA', 'Wrong Answer'];
    if (t.includes('time')) return ['TLE', 'Time Limit'];
    if (t.includes('runtime') || t.includes('sig')) return ['RE', 'Runtime Error'];
    if (t.includes('compil')) return ['CE', 'Compilation Error'];
    return ['OTHER', r.result || 'Partial'];
  };
  const recent: RecentSub[] = feed.map((r) => {
    const [v, label] = verdictOf(r);
    return {
      title: r.problem, url: `https://www.codechef.com/problems/${r.problem}`,
      lang: r.lang || '—', verdict: v, verdictLabel: label, when: ccTime(r.time),
    };
  });
  const byDay = new Map<string, number>();
  feed.filter(isAC).forEach((r) => {
    const t = ccTime(r.time);
    if (t) { const k = dayKey(t); byDay.set(k, (byDay.get(k) || 0) + 1); }
  });
  const activity = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count }));

  const tagsByProblem: Record<string, string[]> = d.problemTags || {};
  const cleanTags = (code: string) => (tagsByProblem[code] || []).filter((t) => !CC_JUNK_TAG.test(t));
  const solvedCodes = [...new Set(feed.filter(isAC).map((r) => r.problem))];
  const tagCount = new Map<string, number>();
  const diff = { easy: 0, medium: 0, hard: 0 };
  let diffKnown = 0;
  solvedCodes.forEach((code) => {
    let diffTagged = false;
    cleanTags(code).forEach((t) => {
      const dt = CC_DIFF_TAG[t.toLowerCase()];
      if (dt) { if (!diffTagged) { diff[dt] += 1; diffKnown += 1; diffTagged = true; } }
      else tagCount.set(t, (tagCount.get(t) || 0) + 1);
    });
  });
  const topics = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, solved]) => ({ name, solved }));

  const solvedRows: SolvedRow[] = solvedCodes.map((code, i) => {
    const first = feed.find((r) => r.problem === code && isAC(r));
    return {
      n: i + 1, title: code,
      topic: cleanTags(code).filter((t) => !CC_DIFF_TAG[t.toLowerCase()])[0],
      lang: first?.lang, when: first ? ccTime(first.time) : undefined,
      url: `https://www.codechef.com/problems/${code}`,
    };
  });

  return {
    platform: 'codechef',
    username,
    displayName: d.name || username,
    profileUrl: PLATFORM_META.codechef.profileUrl(username),
    metrics: [
      { key: 'solved', label: 'Problems Solved', value: nf(d.fullySolved ?? null) },
      { key: 'rating', label: 'Current Rating', value: d.rating ? String(d.rating) : 'Unrated', sub: d.stars ? `${d.stars}★` : undefined },
      { key: 'highest', label: 'Highest Rating', value: d.highest ? String(d.highest) : '—' },
      { key: 'contests', label: 'Contests', value: nf(history.length) },
      { key: 'grank', label: 'Global Rank', value: d.globalRank ? `#${nf(d.globalRank)}` : '—' },
      { key: 'crank', label: 'Country Rank', value: d.countryRank ? `#${nf(d.countryRank)}` : '—' },
    ],
    activity: activity.length ? activity : null,
    difficulty: diffKnown > 0 ? diff : null,
    topics: topics.length ? topics : null,
    recent: recent.length ? recent : null,
    solved: solvedRows.length ? solvedRows : null,
    contest: history.length || d.rating
      ? { rating: d.rating ?? null, maxRating: d.highest ?? null, count: history.length, bestRank, history }
      : null,
    fetchedAt: Date.now(),
  };
};

// ── HackerRank ──────────────────────────────────────────────────────────────

const hackerrankAdapter = async (username: string): Promise<PlatformReport> => {
  const d = await getJson(`${API_BASE}/coding-analytics/hackerrank/${encodeURIComponent(username)}`);
  const badges: any[] = d.badges || [];
  const scores: any[] = d.scores || [];
  const challenges: any[] = d.recentChallenges || [];
  const totalStars = badges.reduce((s, b) => s + (Number(b.stars) || 0), 0);
  const totalSolved = badges.reduce((s, b) => s + (Number(b.solved) || 0), 0);
  const practiceScore = scores.reduce((s, x) => s + (Number(x.practiceScore) || 0), 0);
  const byDay = new Map<string, number>();
  challenges.forEach((c) => {
    const t = new Date(c.createdAt).getTime();
    if (t) { const k = dayKey(t); byDay.set(k, (byDay.get(k) || 0) + 1); }
  });
  const activity = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count }));
  return {
    platform: 'hackerrank',
    username,
    displayName: d.profile?.name || username,
    avatar: d.profile?.avatar,
    profileUrl: PLATFORM_META.hackerrank.profileUrl(username),
    metrics: [
      { key: 'solved', label: 'Challenges Solved', value: nf(totalSolved) },
      { key: 'badges', label: 'Badges', value: nf(badges.length) },
      { key: 'stars', label: 'Total Stars', value: nf(totalStars) },
      { key: 'score', label: 'Practice Score', value: nf(Math.round(practiceScore)) },
      { key: 'tracks', label: 'Skill Tracks', value: nf(scores.length) },
      { key: 'top', label: 'Top Badge', value: badges[0]?.name || '—', sub: badges[0] ? `${badges[0].stars}★` : undefined },
    ],
    activity: activity.length ? activity : null,
    difficulty: null,
    topics: badges.length ? badges.map((b) => ({ name: b.name, solved: Number(b.solved) || 0 })) : null,
    recent: challenges.length
      ? challenges.map((c) => ({
          title: c.name, url: c.url, lang: '—',
          verdict: 'AC' as Verdict, verdictLabel: 'Solved',
          when: new Date(c.createdAt).getTime() || 0,
        }))
      : null,
    solved: challenges.length
      ? challenges.map((c, i) => ({ n: i + 1, title: c.name, when: new Date(c.createdAt).getTime() || 0, url: c.url }))
      : null,
    contest: null,
    fetchedAt: Date.now(),
  };
};

// ── AtCoder ─────────────────────────────────────────────────────────────────

const AT_VERDICTS: Record<string, [Verdict, string]> = {
  AC: ['AC', 'Accepted'], WA: ['WA', 'Wrong Answer'], TLE: ['TLE', 'Time Limit'],
  RE: ['RE', 'Runtime Error'], CE: ['CE', 'Compilation Error'],
};

const atcoderAdapter = async (username: string): Promise<PlatformReport> => {
  const d = await getJson(`${API_BASE}/coding-analytics/atcoder/${encodeURIComponent(username)}`);
  const subs: any[] = d.submissions || [];
  const acSubs = subs.filter((s) => s.result === 'AC');
  const solvedMap = new Map<string, any>();
  acSubs.forEach((s) => { if (!solvedMap.has(s.problemId)) solvedMap.set(s.problemId, s); });

  const byDay = new Map<string, number>();
  acSubs.forEach((s) => { const k = dayKey(s.epochSecond * 1000); byDay.set(k, (byDay.get(k) || 0) + 1); });
  const activity = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count }));

  const diff = { easy: 0, medium: 0, hard: 0 };
  solvedMap.forEach((s) => {
    const p = Number(s.point) || 0;
    if (p <= 200) diff.easy += 1; else if (p <= 400) diff.medium += 1; else diff.hard += 1;
  });

  const recent: RecentSub[] = subs.slice(-15).reverse().map((s) => {
    const [v, label] = AT_VERDICTS[s.result] || (['OTHER', s.result] as [Verdict, string]);
    return {
      title: s.problemId,
      url: `https://atcoder.jp/contests/${s.contestId}/tasks/${s.problemId}`,
      lang: s.language, verdict: v, verdictLabel: label, when: s.epochSecond * 1000,
    };
  });

  const history = (d.history || []).map((h: any) => ({
    label: h.contest, rating: h.newRating, t: new Date(h.endTime).getTime() || 0,
  }));
  const bestRank = (d.history || []).reduce((m: number | null, h: any) => (m === null || h.place < m ? h.place : m), null);
  const lastRating = history.length ? history[history.length - 1].rating : null;
  const maxRating = history.reduce((m: number | null, h: any) => (m === null || h.rating > m ? h.rating : m), null);

  return {
    platform: 'atcoder',
    username,
    displayName: username,
    profileUrl: PLATFORM_META.atcoder.profileUrl(username),
    metrics: [
      { key: 'solved', label: 'Problems Solved', value: nf(solvedMap.size) },
      { key: 'subs', label: 'Total Submissions', value: nf(subs.length) },
      { key: 'acceptance', label: 'Acceptance Rate', value: subs.length ? `${Math.round((acSubs.length / subs.length) * 1000) / 10}%` : '—' },
      { key: 'rating', label: 'Current Rating', value: lastRating !== null ? String(lastRating) : 'Unrated' },
      { key: 'max', label: 'Maximum Rating', value: maxRating !== null ? String(maxRating) : '—' },
      { key: 'contests', label: 'Contests', value: nf(history.length) },
    ],
    activity,
    difficulty: solvedMap.size ? diff : { easy: 0, medium: 0, hard: 0 },
    topics: null,
    recent,
    solved: Array.from(solvedMap.values()).sort((a, b) => b.epochSecond - a.epochSecond)
      .map((s, i) => ({ n: i + 1, title: s.problemId, lang: s.language, when: s.epochSecond * 1000, url: `https://atcoder.jp/contests/${s.contestId}/tasks/${s.problemId}` })),
    contest: history.length ? { rating: lastRating, maxRating, count: history.length, bestRank, history } : null,
    fetchedAt: Date.now(),
  };
};

// ── Entry point ─────────────────────────────────────────────────────────────

const ADAPTERS: Record<PlatformKey, (u: string) => Promise<PlatformReport>> = {
  leetcode: leetcodeAdapter,
  codeforces: codeforcesAdapter,
  codechef: codechefAdapter,
  hackerrank: hackerrankAdapter,
  atcoder: atcoderAdapter,
};

export const fetchPlatformReport = (platform: PlatformKey): Promise<PlatformReport> => {
  const username = CODING_ACCOUNTS[platform];
  if (!username) return Promise.reject(new Error('NOT_CONNECTED'));
  return ADAPTERS[platform](username);
};
