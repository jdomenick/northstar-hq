export type Venture = {
  id: string;
  name: string;
  description: string;
  status: "Scaling" | "Steady" | "Launching" | "Rebuilding";
  focus: string;
  activeProjects: number;
  openDecisions: number;
  risks: number;
  mrr?: string;
  trend?: string;
  color: string;
  priorities: string[];
  recentDecisions: { title: string; when: string }[];
  metrics: { label: string; value: string; delta?: string }[];
  activity: { at: string; text: string }[];
};

export const ventures: Venture[] = [
  {
    id: "healing-path",
    name: "Healing Path",
    description: "Trauma-informed coaching platform for high-performers.",
    status: "Scaling",
    focus: "Q1: Enterprise pilot with two clinics.",
    activeProjects: 6,
    openDecisions: 2,
    risks: 1,
    mrr: "$48.2K",
    trend: "+12% MoM",
    color: "oklch(0.72 0.14 155)",
    priorities: [
      "Close Mercy Health pilot agreement",
      "Onboard clinical advisor",
      "Ship intake redesign v2",
    ],
    recentDecisions: [
      { title: "Move billing to Stripe Connect", when: "2d ago" },
      { title: "Hire second clinical writer", when: "5d ago" },
    ],
    metrics: [
      { label: "MRR", value: "$48.2K", delta: "+12%" },
      { label: "Active clients", value: "184", delta: "+9" },
      { label: "NPS", value: "72" },
      { label: "Cash runway", value: "18 mo" },
    ],
    activity: [
      { at: "1h ago", text: "Operator flagged low session-completion in cohort C." },
      { at: "Today", text: "Contract sent to Mercy Health." },
      { at: "Yesterday", text: "3 new coach applications reviewed." },
    ],
  },
  {
    id: "elite-fleet-rides",
    name: "Elite Fleet Rides",
    description: "Chauffeured luxury transport for corporate travel.",
    status: "Steady",
    focus: "Q1: Expand Atlanta corporate accounts.",
    activeProjects: 4,
    openDecisions: 1,
    risks: 2,
    mrr: "$126K",
    trend: "+3% MoM",
    color: "oklch(0.72 0.11 220)",
    priorities: [
      "Sign second Fortune 500 account",
      "Replace dispatch software",
      "Finalize insurance renewal",
    ],
    recentDecisions: [
      { title: "Delay EV fleet addition to Q3", when: "1w ago" },
    ],
    metrics: [
      { label: "Monthly revenue", value: "$126K", delta: "+3%" },
      { label: "Fleet utilization", value: "71%", delta: "-2%" },
      { label: "Repeat clients", value: "62%" },
      { label: "Driver retention", value: "93%" },
    ],
    activity: [
      { at: "3h ago", text: "Insurance quote received from Chubb." },
      { at: "Yesterday", text: "Dispatch outage — 22 min." },
    ],
  },
  {
    id: "light-in-the-tunnel",
    name: "Light In The Tunnel",
    description: "Nonprofit mentoring formerly incarcerated youth.",
    status: "Launching",
    focus: "Q1: Secure founding donor cohort.",
    activeProjects: 3,
    openDecisions: 3,
    risks: 1,
    color: "oklch(0.78 0.14 75)",
    priorities: [
      "File 501(c)(3) determination",
      "Onboard board chair",
      "Design first mentor cohort",
    ],
    recentDecisions: [
      { title: "Anchor pilot in Fulton County", when: "3d ago" },
      { title: "Rename program track from 'Rise' to 'Passage'", when: "1w ago" },
    ],
    metrics: [
      { label: "Committed donors", value: "14" },
      { label: "Pledged (YTD)", value: "$186K" },
      { label: "Mentor pipeline", value: "38" },
    ],
    activity: [
      { at: "5h ago", text: "Board deck v3 shared with prospective chair." },
    ],
  },
  {
    id: "personal-brand",
    name: "Personal Brand",
    description: "Public writing, speaking, and executive presence.",
    status: "Steady",
    focus: "Q1: Launch essay series on operator craft.",
    activeProjects: 2,
    openDecisions: 1,
    risks: 0,
    color: "oklch(0.72 0.09 300)",
    priorities: [
      "Publish essay: 'The Founder as Operator'",
      "Confirm keynote — SaaStr Founders Dinner",
    ],
    recentDecisions: [
      { title: "Decline podcast tour Q1", when: "4d ago" },
    ],
    metrics: [
      { label: "Newsletter", value: "24.1K", delta: "+412" },
      { label: "Open rate", value: "48%" },
      { label: "Speaking (booked)", value: "3" },
    ],
    activity: [
      { at: "Today", text: "Draft essay sent to editor." },
    ],
  },
];

export type Project = {
  id: string;
  name: string;
  venture: string;
  owner: string;
  status: "On track" | "At risk" | "Blocked" | "Shipped";
  progress: number;
  due: string;
  nextStep: string;
};

export const projects: Project[] = [
  { id: "p1", name: "Mercy Health enterprise pilot", venture: "Healing Path", owner: "Jeff", status: "At risk", progress: 62, due: "Mar 14", nextStep: "Legal review of MSA" },
  { id: "p2", name: "Intake redesign v2", venture: "Healing Path", owner: "Maya", status: "On track", progress: 78, due: "Feb 28", nextStep: "Handoff to engineering" },
  { id: "p3", name: "Dispatch software replacement", venture: "Elite Fleet Rides", owner: "Andre", status: "Blocked", progress: 34, due: "Apr 02", nextStep: "Vendor decision — Samsara vs Motive" },
  { id: "p4", name: "Atlanta enterprise sales sprint", venture: "Elite Fleet Rides", owner: "Jeff", status: "On track", progress: 45, due: "Mar 30", nextStep: "3 discovery calls this week" },
  { id: "p5", name: "501(c)(3) filing", venture: "Light In The Tunnel", owner: "Rae", status: "At risk", progress: 55, due: "Feb 20", nextStep: "Attorney response overdue 4d" },
  { id: "p6", name: "Founding donor cohort", venture: "Light In The Tunnel", owner: "Jeff", status: "On track", progress: 40, due: "Apr 15", nextStep: "6 pledge calls scheduled" },
  { id: "p7", name: "Essay series launch", venture: "Personal Brand", owner: "Jeff", status: "On track", progress: 70, due: "Mar 08", nextStep: "Final edit round" },
];

export type Decision = {
  id: string;
  title: string;
  venture: string;
  stakes: "Reversible" | "One-way door";
  waitingOn: string;
  raised: string;
  context: string;
};

export const decisions: Decision[] = [
  {
    id: "d1",
    title: "Approve Mercy Health MSA at reduced margin",
    venture: "Healing Path",
    stakes: "One-way door",
    waitingOn: "Jeff",
    raised: "2d ago",
    context: "Signs a two-year anchor customer at 22% below target margin. Establishes clinical proof.",
  },
  {
    id: "d2",
    title: "Choose dispatch vendor: Samsara or Motive",
    venture: "Elite Fleet Rides",
    stakes: "Reversible",
    waitingOn: "Jeff + Andre",
    raised: "5d ago",
    context: "Both viable. Samsara is safer, Motive is 34% cheaper and faster to migrate.",
  },
  {
    id: "d3",
    title: "Accept board chair candidate — Rev. Ellis",
    venture: "Light In The Tunnel",
    stakes: "One-way door",
    waitingOn: "Jeff",
    raised: "6h ago",
    context: "Community trust and mission alignment are strong. Limited governance experience.",
  },
  {
    id: "d4",
    title: "Decline SaaStr keynote to protect writing time",
    venture: "Personal Brand",
    stakes: "Reversible",
    waitingOn: "Jeff",
    raised: "1d ago",
    context: "High visibility but conflicts with essay launch week.",
  },
];