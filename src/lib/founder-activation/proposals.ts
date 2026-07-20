// Static proposal set for the Founder Activation workflow.
//
// Content is the founder's verbatim intake. Priority and status values map to
// existing NorthStar Labs enums. Nothing here invents dates, owners, or metrics.

export type ProposalPriority = "low" | "normal" | "high" | "critical";

export type VentureProposal = {
  key: string;
  name: string;
  priority: ProposalPriority;
  description: string;
  strategicDirection: string;
};

export type ProjectProposal = {
  key: string;
  ventureKey: string;
  name: string;
  status: "planned" | "active" | "blocked" | "at_risk";
  priority: ProposalPriority;
  objective: string;
  blocker?: string;
};

export type GoalProposal = {
  key: string;
  ventureKey: string;
  title: string;
  priority: ProposalPriority;
  definitionOfSuccess: string;
};

export type DecisionProposal = {
  key: string;
  title: string;
  decision: string;
  rationale?: string;
};

export type CommitmentProposal = {
  key: string;
  ventureKey: string;
  title: string;
  status: "open" | "waiting" | "in_progress";
  blocker?: string;
  note?: string;
};

export const VENTURES: VentureProposal[] = [
  {
    key: "healing-path",
    name: "Healing Path System",
    priority: "critical",
    description:
      "A trauma-informed recovery platform and content ecosystem supporting people through trauma recovery, daily reflection, journaling, check-ins, guided exercises, education, and community.",
    strategicDirection:
      "Stop marketing the app as the product. Build Healing Path into one of the most trusted voices in trauma recovery. Trust is the product, and Healing Path is where people continue the journey.",
  },
  {
    key: "northstar-hq",
    name: "NorthStar Labs HQ",
    priority: "critical",
    description:
      "An executive operating system that gives SAM shared business context, governed authority, operational tools, decision history, and the ability to recommend, execute, verify, and learn across multiple ventures.",
    strategicDirection:
      "Prove one complete end-to-end autonomous operating loop before expanding additional providers or capabilities.",
  },
  {
    key: "warpath",
    name: "Warpath Ministries",
    priority: "high",
    description:
      "A Christian ministry focused on trauma recovery, addiction healing, mental health, suicide prevention, homelessness, discipleship, community, and faith-based recovery resources.",
    strategicDirection:
      "Build a living ministry platform that supports members through Scripture, prayer, teaching, recovery meetings, testimonies, programs, events, and real human connection.",
  },
  {
    key: "elite-fleet",
    name: "Elite Fleet Rides",
    priority: "high",
    description:
      "A veteran-owned private transportation company serving New Jersey, New York, and Pennsylvania for airport transfers, concerts, weddings, nights out, business travel, casinos, and medical appointments.",
    strategicDirection:
      "Increase repeat clients, local visibility, fleet utilization, and profitable booked rides.",
  },
  {
    key: "jeff-personal",
    name: "Jeff Domenick Jr. and Light In The Tunnel",
    priority: "high",
    description:
      "Jeff Domenick Jr.'s personal brand, writing platform, newsletter, trauma recovery voice, speaking, coaching, consulting, and daily Today's Light content.",
    strategicDirection:
      "Build trust through honest, personal, useful content that makes people feel understood before promoting any product or service.",
  },
];

export const PROJECTS: ProjectProposal[] = [
  // NorthStar Labs HQ
  {
    key: "sam-e2e",
    ventureKey: "northstar-hq",
    name: "SAM End-to-End Automation Proof",
    status: "active",
    priority: "critical",
    objective:
      "Prove that SAM can identify an opportunity, generate a recommendation, apply approval policy, schedule an action, execute through a server-side worker, verify the external result, update NorthStar Labs, and recommend the next action. Success requires: a real external action occurs; the browser does not need to remain open; the action is verified externally; full execution history is stored; no duplicate action occurs; Executive Brief is updated; SAM creates a follow-up recommendation.",
  },
  {
    key: "meta-validation",
    ventureKey: "northstar-hq",
    name: "Meta Social Publishing Validation",
    status: "blocked",
    priority: "high",
    objective:
      "Connect Facebook and Instagram through the Meta Graph API and validate one Facebook Page post followed by one Instagram single-image post.",
    blocker:
      "META_APP_ID, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN, and successful Meta OAuth are required.",
  },
  {
    key: "beehiiv-validation",
    ventureKey: "northstar-hq",
    name: "Beehiiv Live Automation Validation",
    status: "planned",
    priority: "high",
    objective:
      "Determine which real Beehiiv write actions are available and use the safest supported action to validate the complete SAM automation loop.",
  },
  {
    key: "social-roadmap",
    ventureKey: "northstar-hq",
    name: "Social Provider Roadmap",
    status: "active",
    priority: "normal",
    objective:
      "Add and validate social publishing providers in a controlled sequence: 1. Facebook, 2. Instagram, 3. LinkedIn, 4. X, 5. Reddit. Do not begin later providers until the first end-to-end publication loop is proven.",
  },
  // Healing Path
  {
    key: "hp-voice",
    ventureKey: "healing-path",
    name: "Healing Path Trusted Voice Strategy",
    status: "active",
    priority: "critical",
    objective:
      "Make Healing Path and Jeff Domenick Jr. a trusted voice in trauma recovery by publishing content that makes people feel understood before promoting the platform.",
  },
  {
    key: "hp-outreach",
    ventureKey: "healing-path",
    name: "Recovery Center Outreach",
    status: "active",
    priority: "high",
    objective:
      "Build a qualified list of recovery centers, behavioral health organizations, trauma programs, and potential institutional partners, then conduct controlled personalized outreach.",
  },
  {
    key: "hp-social",
    ventureKey: "healing-path",
    name: "Healing Path Social Publishing",
    status: "blocked",
    priority: "high",
    objective: "Automate approved Facebook and Instagram content publishing through NorthStar Labs and SAM.",
    blocker: "Meta developer credentials and OAuth.",
  },
  {
    key: "hp-growth",
    ventureKey: "healing-path",
    name: "Healing Path App Growth",
    status: "active",
    priority: "high",
    objective:
      "Improve awareness, user activation, retention, downloads, reviews, and continued engagement for the Healing Path web and mobile experience.",
  },
  {
    key: "hp-android",
    ventureKey: "healing-path",
    name: "Android Release and Testing",
    status: "active",
    priority: "normal",
    objective:
      "Complete Android testing, resolve release issues, and launch the production Android version.",
  },
  // Warpath
  {
    key: "wp-living",
    ventureKey: "warpath",
    name: "Warpath Founder Living Mode",
    status: "active",
    priority: "high",
    objective:
      "Use the Warpath app as a founder and identify real moments of friction before adding more features.",
  },
  {
    key: "wp-content",
    ventureKey: "warpath",
    name: "Warpath Content Population",
    status: "active",
    priority: "high",
    objective:
      "Populate the app with real devotionals, Scripture, books, teachings, meetings, programs, testimonies, events, and ministry resources.",
  },
  {
    key: "wp-warroom",
    ventureKey: "warpath",
    name: "War Room Operations",
    status: "active",
    priority: "normal",
    objective:
      "Support recurring recovery meetings, attendance, follow-up, prayer needs, and community participation.",
  },
  // Elite Fleet Rides
  {
    key: "efr-growth",
    ventureKey: "elite-fleet",
    name: "Local Transportation Growth",
    status: "active",
    priority: "high",
    objective:
      "Increase qualified bookings across airport transportation, concerts, weddings, nights out, business transportation, casino trips, and medical transportation.",
  },
  {
    key: "efr-followup",
    ventureKey: "elite-fleet",
    name: "Repeat Client Follow-Up",
    status: "planned",
    priority: "high",
    objective:
      "Build a structured system for client follow-up, repeat bookings, referrals, reviews, and seasonal outreach.",
  },
  {
    key: "efr-fleet",
    ventureKey: "elite-fleet",
    name: "Fleet Utilization",
    status: "active",
    priority: "normal",
    objective:
      "Improve visibility into vehicle availability, trip profitability, booking demand, and fleet utilization.",
  },
  // Jeff personal
  {
    key: "jd-todaylight",
    ventureKey: "jeff-personal",
    name: "Today's Light Publishing System",
    status: "active",
    priority: "high",
    objective:
      "Create and publish consistent, personal, trauma-informed daily reflections across the newsletter, website, and social channels.",
  },
  {
    key: "jd-authority",
    ventureKey: "jeff-personal",
    name: "Jeff Domenick Jr. Authority Platform",
    status: "active",
    priority: "high",
    objective:
      "Build Jeff's personal authority across trauma recovery, entrepreneurship, leadership, recovery, faith, coaching, and lived experience.",
  },
  {
    key: "jd-litt",
    ventureKey: "jeff-personal",
    name: "Light In The Tunnel Community Growth",
    status: "active",
    priority: "normal",
    objective:
      "Grow the newsletter and community through high-value content, recurring engagement, and trusted conversations.",
  },
];

export const GOALS: GoalProposal[] = [
  {
    key: "g-loop",
    ventureKey: "northstar-hq",
    title: "Prove SAM Can Close the Loop",
    priority: "critical",
    definitionOfSuccess:
      "SAM completes and verifies one real external action from recommendation through follow-up without requiring an open browser.",
  },
  {
    key: "g-meta",
    ventureKey: "northstar-hq",
    title: "Connect Facebook and Instagram",
    priority: "high",
    definitionOfSuccess:
      "NorthStar Labs discovers the Healing Path Facebook Page and Instagram professional account and successfully publishes and verifies one controlled post on each.",
  },
  {
    key: "g-hp-trust",
    ventureKey: "healing-path",
    title: "Build Healing Path Trust",
    priority: "critical",
    definitionOfSuccess:
      "Healing Path consistently publishes useful trauma recovery content that increases meaningful engagement, trust, subscribers, users, partnerships, and community participation.",
  },
  {
    key: "g-hp-partner",
    ventureKey: "healing-path",
    title: "Create Institutional Healing Path Partnerships",
    priority: "high",
    definitionOfSuccess:
      "Recovery centers and behavioral health organizations begin evaluating, recommending, licensing, or partnering with Healing Path.",
  },
  {
    key: "g-efr",
    ventureKey: "elite-fleet",
    title: "Increase Profitable EFR Bookings",
    priority: "high",
    definitionOfSuccess:
      "Increase qualified bookings, repeat customers, referral activity, and profitable fleet usage.",
  },
];

export const DECISIONS: DecisionProposal[] = [
  {
    key: "d-one-os",
    title: "Use One Shared Executive Operating System",
    decision:
      "NorthStar Labs will use SAM as the central intelligence and orchestration layer. Specialized functions may exist, but they must share the same ventures, goals, projects, decisions, commitments, documents, memory, and governance.",
    rationale:
      "Disconnected AI executive tools would create conflicting priorities, fragmented memory, and operational silos.",
  },
  {
    key: "d-close-loop",
    title: "Prove One Closed Loop Before Expanding",
    decision:
      "Do not keep adding integrations and architecture until SAM successfully completes one real, externally verified automation loop.",
  },
  {
    key: "d-meta-freeze",
    title: "Freeze Meta Framework Until Credentials",
    decision:
      "The Meta framework is frozen. No additional Meta architecture will be built until credentials and live OAuth are available.",
  },
  {
    key: "d-fb-ig-first",
    title: "Facebook and Instagram Before Other Social Providers",
    decision:
      "The social provider order is Facebook, Instagram, LinkedIn, X, and Reddit.",
  },
  {
    key: "d-hp-voice",
    title: "Build the Healing Path Voice Before Marketing the App",
    decision:
      "Healing Path content will focus primarily on trust, lived experience, trauma education, emotional recognition, and useful recovery guidance rather than repeatedly promoting downloads.",
  },
  {
    key: "d-wp-separate",
    title: "Keep Warpath Separate from Healing Path",
    decision:
      "Warpath Ministries will remain a separate faith-based ministry platform and must not copy Healing Path language, design, or product positioning.",
  },
  {
    key: "d-sam-in-northstar",
    title: "Keep SAM Inside NorthStar Labs for Now",
    decision:
      "SAM remains part of NorthStar Labs HQ until its role, architecture, and value are proven strongly enough to justify a standalone product.",
  },
];

export const COMMITMENTS: CommitmentProposal[] = [
  {
    key: "c-meta-app",
    ventureKey: "northstar-hq",
    title: "Create the Meta Developer App using an eligible business administrator account.",
    status: "open",
  },
  {
    key: "c-meta-secrets",
    ventureKey: "northstar-hq",
    title: "Add META_APP_ID, META_APP_SECRET, and META_WEBHOOK_VERIFY_TOKEN.",
    status: "waiting",
    blocker: "Meta Developer App must be created first.",
  },
  {
    key: "c-e2e-test",
    ventureKey: "northstar-hq",
    title: "Run one real end-to-end SAM automation test.",
    status: "open",
  },
  {
    key: "c-no-expand",
    ventureKey: "northstar-hq",
    title: "Do not expand additional social providers until the first automation test is verified.",
    status: "in_progress",
    note: "Active guardrail.",
  },
];

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
