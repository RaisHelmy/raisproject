/**
 * Gamification engine: tiers, achievements and the points ledger.
 *
 * Points are only ever written as ledger entries (auditable). Achievements
 * are evaluated idempotently from real data — journey milestones, executed
 * transactions, analysis runs and referrals — and award their points once,
 * at unlock time.
 */

import type { Env } from "./types";
import { randomHex } from "./auth";

/* ---------------- tiers ---------------- */

export interface Tier {
  id: string;
  name: string;
  icon: string;
  min: number;
}

export const TIERS: Tier[] = [
  { id: "bronze", name: "Bronze", icon: "🥉", min: 0 },
  { id: "silver", name: "Silver", icon: "🥈", min: 500 },
  { id: "gold", name: "Gold", icon: "🥇", min: 1500 },
  { id: "platinum", name: "Platinum", icon: "💠", min: 4000 },
  { id: "diamond", name: "Diamond", icon: "💎", min: 10000 },
];

export function tierFor(points: number): { current: Tier; next: Tier | null; progressPct: number } {
  let current = TIERS[0];
  for (const t of TIERS) if (points >= t.min) current = t;
  const idx = TIERS.indexOf(current);
  const next = idx + 1 < TIERS.length ? TIERS[idx + 1] : null;
  const progressPct = next
    ? Math.min(100, Math.round(((points - current.min) / (next.min - current.min)) * 100))
    : 100;
  return { current, next, progressPct };
}

/* ---------------- achievements catalog ---------------- */

export interface Metrics {
  ordersDone: number;
  analysesDone: number;
  referrals: number;
  emailVerified: boolean;
  guidance: Record<string, unknown>;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  category: "journey" | "growth" | "affiliate";
  /** progress toward unlock, in [current, target] form */
  progress: (m: Metrics) => { current: number; target: number };
}

const flag = (m: Metrics, key: string) => (m.guidance[key] ? 1 : 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  // Journey
  { id: "first-steps", name: "First Steps", icon: "👣", points: 50, category: "journey",
    description: "Complete onboarding and set up your profile.",
    progress: (m) => ({ current: flag(m, "profileDone"), target: 1 }) },
  { id: "verified", name: "Verified", icon: "✅", points: 50, category: "journey",
    description: "Verify your email address.",
    progress: (m) => ({ current: m.emailVerified ? 1 : 0, target: 1 }) },
  { id: "connected", name: "Plugged In", icon: "🔌", points: 75, category: "journey",
    description: "Connect your first brokerage.",
    progress: (m) => ({ current: flag(m, "brokerageConnected"), target: 1 }) },
  { id: "first-sync", name: "In Sync", icon: "🔄", points: 75, category: "journey",
    description: "Synchronize your portfolio for the first time.",
    progress: (m) => ({ current: flag(m, "portfolioSynced"), target: 1 }) },
  { id: "family-circle", name: "Family Circle", icon: "👪", points: 75, category: "journey",
    description: "Add your family members and assign roles.",
    progress: (m) => ({ current: flag(m, "familyAdded"), target: 1 }) },
  { id: "legacy-guardian", name: "Legacy Guardian", icon: "🕊️", points: 150, category: "journey",
    description: "Complete all seven steps of your legacy plan.",
    progress: (m) => ({ current: flag(m, "legacyDone"), target: 1 }) },
  { id: "fortress", name: "Fortress", icon: "🛡️", points: 50, category: "journey",
    description: "Complete your security review.",
    progress: (m) => ({ current: flag(m, "securityDone"), target: 1 }) },

  // Transaction growth
  { id: "first-trade", name: "First Trade", icon: "🎯", points: 100, category: "growth",
    description: "Execute your first order through the investment queue.",
    progress: (m) => ({ current: Math.min(m.ordersDone, 1), target: 1 }) },
  { id: "deal-maker", name: "Deal Maker", icon: "📈", points: 200, category: "growth",
    description: "Execute 5 orders.",
    progress: (m) => ({ current: Math.min(m.ordersDone, 5), target: 5 }) },
  { id: "growth-engine", name: "Growth Engine", icon: "🚀", points: 500, category: "growth",
    description: "Execute 25 orders — sustained transaction growth.",
    progress: (m) => ({ current: Math.min(m.ordersDone, 25), target: 25 }) },
  { id: "analyst", name: "Analyst", icon: "🔍", points: 50, category: "growth",
    description: "Run your first algorithm analysis.",
    progress: (m) => ({ current: Math.min(m.analysesDone, 1), target: 1 }) },
  { id: "quant-master", name: "Quant Master", icon: "🧠", points: 200, category: "growth",
    description: "Run 10 analysis jobs through the queue.",
    progress: (m) => ({ current: Math.min(m.analysesDone, 10), target: 10 }) },

  // Affiliate
  { id: "first-referral", name: "The Spark", icon: "✨", points: 100, category: "affiliate",
    description: "Your first friend joins Rais Fintech through your link.",
    progress: (m) => ({ current: Math.min(m.referrals, 1), target: 1 }) },
  { id: "connector", name: "Connector", icon: "🤝", points: 300, category: "affiliate",
    description: "3 people join through your link.",
    progress: (m) => ({ current: Math.min(m.referrals, 3), target: 3 }) },
  { id: "ambassador", name: "Ambassador", icon: "🏅", points: 1000, category: "affiliate",
    description: "10 people join through your link.",
    progress: (m) => ({ current: Math.min(m.referrals, 10), target: 10 }) },
];

/* ---------------- data access ---------------- */

export async function addPoints(env: Env, userId: string, points: number, reason: string) {
  await env.DB.prepare("INSERT INTO points_ledger (id, user_id, points, reason) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, points, reason)
    .run();
}

export async function totalPoints(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(points), 0) AS total FROM points_ledger WHERE user_id = ?"
  )
    .bind(userId)
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export async function pointsRank(env: Env, points: number): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT u.id, COALESCE((SELECT SUM(points) FROM points_ledger l WHERE l.user_id = u.id), 0) AS p
       FROM users u
     ) WHERE p > ?`
  )
    .bind(points)
    .first<{ n: number }>();
  return (row?.n ?? 0) + 1;
}

export async function gatherMetrics(env: Env, userId: string): Promise<Metrics> {
  const [orders, analyses, refs, user, g] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM jobs WHERE user_id = ? AND type = 'order' AND status = 'done'")
      .bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM jobs WHERE user_id = ? AND type = 'analysis' AND status = 'done'")
      .bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE referred_by = ?")
      .bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT email_verified FROM users WHERE id = ?")
      .bind(userId).first<{ email_verified: number }>(),
    env.DB.prepare("SELECT data FROM guidance WHERE user_id = ?")
      .bind(userId).first<{ data: string }>(),
  ]);
  let guidance: Record<string, unknown> = {};
  try {
    guidance = g ? JSON.parse(g.data) : {};
  } catch { /* corrupt guidance never blocks rewards */ }
  return {
    ordersDone: orders?.n ?? 0,
    analysesDone: analyses?.n ?? 0,
    referrals: refs?.n ?? 0,
    emailVerified: !!user?.email_verified,
    guidance,
  };
}

/**
 * Idempotent achievement evaluation: unlock anything newly earned and award
 * its points exactly once. Returns the ids unlocked in this pass.
 */
export async function evaluateAchievements(env: Env, userId: string): Promise<string[]> {
  const metrics = await gatherMetrics(env, userId);
  const { results } = await env.DB.prepare(
    "SELECT achievement_id FROM achievements WHERE user_id = ?"
  )
    .bind(userId)
    .all<{ achievement_id: string }>();
  const owned = new Set(results.map((r) => r.achievement_id));

  const newlyUnlocked: string[] = [];
  for (const def of ACHIEVEMENTS) {
    if (owned.has(def.id)) continue;
    const p = def.progress(metrics);
    if (p.current >= p.target) {
      const ins = await env.DB.prepare(
        "INSERT INTO achievements (user_id, achievement_id) VALUES (?, ?) ON CONFLICT DO NOTHING"
      )
        .bind(userId, def.id)
        .run();
      if (ins.meta.changes) {
        await addPoints(env, userId, def.points, `achievement:${def.id}`);
        newlyUnlocked.push(def.id);
      }
    }
  }
  return newlyUnlocked;
}

/* ---------------- referral codes ---------------- */

export async function ensureReferralCode(env: Env, userId: string): Promise<string> {
  const row = await env.DB.prepare("SELECT referral_code FROM users WHERE id = ?")
    .bind(userId)
    .first<{ referral_code: string | null }>();
  if (row?.referral_code) return row.referral_code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `RAIS-${randomHex(4).toUpperCase()}`;
    const res = await env.DB.prepare(
      "UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL"
    )
      .bind(code, userId)
      .run()
      .catch(() => null); // unique collision → retry
    if (res?.meta.changes) return code;
    const again = await env.DB.prepare("SELECT referral_code FROM users WHERE id = ?")
      .bind(userId)
      .first<{ referral_code: string | null }>();
    if (again?.referral_code) return again.referral_code;
  }
  throw new Error("Could not allocate a referral code.");
}

/** "Rais Helmy" → "Rais H." — leaderboard privacy. */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
