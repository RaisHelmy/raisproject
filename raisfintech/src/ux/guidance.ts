/**
 * Rais Fintech UX Guidance System — core state model.
 *
 * Everything the guidance layer knows about the user's journey lives here:
 * onboarding, setup milestones, feature unlocks, tour history and saved
 * wizard progress. State is persisted so users never lose progress.
 */

export interface GuidanceState {
  /** Finished (or explicitly skipped) the welcome onboarding flow. */
  onboarded: boolean;

  // Setup milestones
  profileDone: boolean;
  brokerageConnected: boolean;
  portfolioSynced: boolean;
  familyAdded: boolean;
  securityDone: boolean;
  legacyDone: boolean;

  // Profile answers captured during onboarding
  profileName: string;
  profileGoal: string;

  // Robo trading readiness
  riskProfileDone: boolean;
  strategyConfigured: boolean;
  paperTraded: boolean;
  liveTradingEnabled: boolean;

  // Family data (demo-level)
  familyMembers: { id: string; name: string; relationship: string; role: string }[];

  // Saved wizard progress (resume later — never lose work)
  legacyStep: number; // 0-based; -1 = not started
  connectStep: number; // -1 = not started

  // Tours already completed or dismissed — never repeat a tour
  toursDone: string[];

  // Remembered navigation state
  expandedGroups: string[];
}

export const initialGuidance: GuidanceState = {
  onboarded: false,
  profileDone: false,
  brokerageConnected: false,
  portfolioSynced: false,
  familyAdded: false,
  securityDone: false,
  legacyDone: false,
  profileName: "",
  profileGoal: "",
  riskProfileDone: false,
  strategyConfigured: false,
  paperTraded: false,
  liveTradingEnabled: false,
  familyMembers: [],
  legacyStep: -1,
  connectStep: -1,
  toursDone: [],
  expandedGroups: ["OVERVIEW", "MONEY", "INVEST", "FAMILY"],
};

/* ------------------------------------------------------------------ */
/* Setup journey                                                       */
/* ------------------------------------------------------------------ */

export interface SetupStep {
  id: string;
  label: string;
  route: string;
  done: (s: GuidanceState) => boolean;
}

export const SETUP_STEPS: SetupStep[] = [
  { id: "profile", label: "Profile", route: "/welcome", done: (s) => s.profileDone },
  { id: "brokerage", label: "Brokerage connection", route: "/connections/moomoo", done: (s) => s.brokerageConnected },
  { id: "portfolio", label: "Portfolio sync", route: "/invest/portfolio", done: (s) => s.portfolioSynced },
  { id: "family", label: "Family members", route: "/family", done: (s) => s.familyAdded },
  { id: "security", label: "Security review", route: "/system/security", done: (s) => s.securityDone },
  { id: "legacy", label: "Legacy plan", route: "/family/legacy", done: (s) => s.legacyDone },
];

export function setupPercent(s: GuidanceState): number {
  const done = SETUP_STEPS.filter((step) => step.done(s)).length;
  return Math.round((done / SETUP_STEPS.length) * 100);
}

/* ------------------------------------------------------------------ */
/* Next best action                                                    */
/* ------------------------------------------------------------------ */

export interface NextAction {
  icon: string;
  title: string;
  body: string;
  cta: string;
  route: string;
}

/** The dashboard's "what should I do next?" — one clear recommendation. */
export function nextAction(s: GuidanceState): NextAction | null {
  if (!s.profileDone)
    return {
      icon: "👤",
      title: "Complete your profile",
      body: "Tell us who you are and what you want from Rais Fintech, so we can tailor your workspace.",
      cta: "Complete Profile",
      route: "/welcome",
    };
  if (!s.brokerageConnected)
    return {
      icon: "🔐",
      title: "Connect your brokerage",
      body: "Your investment dashboard is currently empty because no brokerage is connected. Connecting Moomoo lets Rais Fintech synchronize your portfolio securely.",
      cta: "Connect Moomoo",
      route: "/connections/moomoo",
    };
  if (!s.portfolioSynced)
    return {
      icon: "🔄",
      title: "Synchronize your portfolio",
      body: "Moomoo is connected. Run your first synchronization to bring your holdings into Rais Fintech.",
      cta: "Sync Portfolio",
      route: "/invest/portfolio",
    };
  if (!s.familyAdded)
    return {
      icon: "👨‍👩‍👧",
      title: "Add your family members",
      body: "Family members are needed before creating your legacy plan and setting up delegation.",
      cta: "Set Up Family",
      route: "/family",
    };
  if (!s.legacyDone)
    return {
      icon: "🕊️",
      title: "Create your Legacy Plan",
      body: "You've completed the foundation. Review your assets and assign the appropriate roles so your family knows what to do when it matters most.",
      cta: s.legacyStep >= 0 ? "Resume Legacy Plan" : "Begin Legacy Plan",
      route: "/family/legacy",
    };
  if (!s.securityDone)
    return {
      icon: "🛡️",
      title: "Review your security",
      body: "Confirm two-factor authentication and emergency access so your workspace stays protected.",
      cta: "Review Security",
      route: "/system/security",
    };
  // Fully set up → the perpetual action: grow together.
  return {
    icon: "🤝",
    title: "You're all set — now grow together",
    body: "Your workspace is fully configured. Invite family and friends: every person who joins through your link earns you both rewards and moves you up the community leaderboard.",
    cta: "Share Rais Fintech",
    route: "/grow/affiliate",
  };
}

/* ------------------------------------------------------------------ */
/* Feature discovery — what the sidebar reveals as the user progresses */
/* ------------------------------------------------------------------ */

export function isFeatureVisible(feature: string, s: GuidanceState): boolean {
  switch (feature) {
    case "robo":
    case "strategies":
      return s.brokerageConnected;
    case "delegation":
    case "legacy":
    case "documents":
      return s.familyAdded;
    case "automation":
      return s.brokerageConnected && s.portfolioSynced;
    default:
      return true;
  }
}
