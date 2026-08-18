// Public website content. Single source of truth for copy shared across the
// marketing routes so pages never drift from one another.

import { SITE_URL } from "./site-url";

export const BRAND = {
  name: "NorthStar Labs",
  tagline: "We find where your business is leaking revenue. Then we fix it.",
  positioning:
    "NorthStar Labs audits the systems between marketing, leads, calls, follow-up, appointments, sales, and revenue. We identify where opportunities are being lost, then build and implement the systems needed to close those gaps.",
  email: "info@northstarlabshq.com",
  siteUrl: SITE_URL,
} as const;

// The delivery model, stated the same way everywhere it appears.
export const DELIVERY_MODEL: { key: string; label: string; detail: string }[] = [
  {
    key: "assess",
    label: "Assess",
    detail: "We inspect the real customer journey, from first touch to closed revenue.",
  },
  {
    key: "identify",
    label: "Identify",
    detail: "We name where opportunities are being lost, and what it costs to leave it alone.",
  },
  {
    key: "build",
    label: "Build",
    detail: "We implement the systems that close the gap, inside the tools you already run.",
  },
  {
    key: "automate",
    label: "Automate",
    detail: "Where automation is the right answer, the work runs without someone remembering to do it.",
  },
  {
    key: "measure",
    label: "Measure",
    detail: "We report what changed using real data, and keep tuning after go live.",
  },
];

// The path revenue travels, and the points where it commonly leaks.
export const REVENUE_PATH: { stage: string; leak: string }[] = [
  { stage: "Marketing", leak: "Spend runs without a clear read on what produced revenue." },
  { stage: "Leads", leak: "Inquiries arrive and sit in an inbox with no owner." },
  { stage: "Calls", leak: "Calls go unanswered after hours and during busy periods." },
  { stage: "Follow-up", leak: "The second and third touch depend on someone remembering." },
  { stage: "Appointments", leak: "No-shows and cancellations are never recovered." },
  { stage: "Sales", leak: "Deals stall mid-pipeline and nobody can say why." },
  { stage: "Revenue", leak: "Numbers live in five tools and no two of them agree." },
];

// Outcome-first capability list. Tools are the means, never the headline.
export const CAPABILITIES: { title: string; body: string }[] = [
  {
    title: "AI receptionists and customer communication",
    body: "Every call and message answered, qualified, and routed with context, including after hours.",
  },
  {
    title: "Lead capture and qualification",
    body: "Inquiries captured from every source and sorted before they reach your team.",
  },
  {
    title: "Automated follow-up",
    body: "A consistent follow-up path for every lead, and reactivation for the ones that went cold.",
  },
  {
    title: "Appointment booking and recovery",
    body: "Booking handled at the moment of interest, with no-shows and cancellations chased back.",
  },
  {
    title: "Customer acquisition systems",
    body: "A repeatable way to create qualified conversations, with the source of each one known.",
  },
  {
    title: "CRM and software integrations",
    body: "We connect the systems you already pay for instead of rebuilding your stack.",
  },
  {
    title: "Workflow automation",
    body: "Manual re-entry, copying, and chasing removed from the steps that do not need a person.",
  },
  {
    title: "Reporting and revenue attribution",
    body: "One truthful view of pipeline, delivery, and what actually produced revenue.",
  },
];

export type Service = {
  slug: string;
  name: string;
  problem: string;
  solution: string;
  outcome: string;
};

export const SERVICES: Service[] = [
  {
    slug: "lead-generation",
    name: "Lead Generation",
    problem: "Demand is inconsistent and the pipeline depends on referrals you cannot control.",
    solution:
      "We build and run a repeatable acquisition system: targeting, offer, campaigns, tracking, and follow-up owned end to end.",
    outcome: "A predictable flow of qualified conversations, with the source of every one of them known.",
  },
  {
    slug: "ai-receptionist",
    name: "AI Receptionist",
    problem: "Calls go unanswered after hours and during busy periods, and those buyers move on.",
    solution:
      "We deploy a voice and messaging front door that answers, qualifies, routes, and books, then hands off to your team with full context.",
    outcome: "Fewer missed calls, faster response times, and more booked appointments from demand you already paid for.",
  },
  {
    slug: "marketing-automation",
    name: "Marketing Automation",
    problem: "Leads sit untouched because follow-up depends on someone remembering to do it.",
    solution:
      "We implement lifecycle sequences, nurture paths, and reactivation campaigns tied to the systems you already use.",
    outcome: "Every lead gets a consistent follow-up path, and dormant lists start producing again.",
  },
  {
    slug: "sales-automation",
    name: "Sales Automation",
    problem: "Deals stall in the middle of the pipeline and nobody can say why.",
    solution:
      "We structure the pipeline, automate handoffs and reminders, and instrument each stage so movement is visible.",
    outcome: "Shorter sales cycles and a pipeline you can forecast against instead of guess at.",
  },
  {
    slug: "workflow-automation",
    name: "Workflow Automation",
    problem: "Your team spends hours a week on manual re-entry, copying, and chasing.",
    solution:
      "We map the real workflow, remove the handoffs that break, and automate the steps that do not need a human.",
    outcome: "Hours returned to the team each week, and fewer errors caused by manual work.",
  },
  {
    slug: "business-process-optimization",
    name: "Business Process Optimization",
    problem: "Growth exposes the process. What worked at one volume breaks at the next.",
    solution:
      "We document how work actually flows, find the constraint, and redesign the process around it.",
    outcome: "More output from the same headcount, with the bottleneck named and removed.",
  },
  {
    slug: "ai-integration",
    name: "AI Integration",
    problem: "AI is everywhere, but almost none of it is connected to how your business actually runs.",
    solution:
      "We apply AI only where it changes a business result: intake, qualification, summarization, drafting, and routing inside your existing systems.",
    outcome: "Measurable time and cost reduction in specific workflows, not a pilot that never ships.",
  },
  {
    slug: "reporting-and-business-intelligence",
    name: "Reporting & Business Intelligence",
    problem: "Numbers live in five tools and no two of them agree.",
    solution:
      "We consolidate the sources that matter and build the small set of reports an owner actually uses to make decisions.",
    outcome: "One truthful view of revenue, pipeline, and delivery, updated without manual assembly.",
  },
  {
    slug: "operational-consulting",
    name: "Operational Consulting",
    problem: "The owner is the bottleneck and every decision routes through one person.",
    solution:
      "We work directly with leadership on operating cadence, accountability, and the sequence of what to fix first.",
    outcome: "Clear priorities, defined ownership, and decisions that no longer wait on one calendar.",
  },
  {
    slug: "custom-business-systems",
    name: "Custom Business Systems",
    problem: "Off-the-shelf tools force the business to work the way the software wants.",
    solution:
      "When nothing on the market fits, we build the system around the operation, not the other way around.",
    outcome: "Software that matches how the business runs, owned by you and measured like everything else.",
  },
];

export const INDUSTRIES: { name: string; note: string }[] = [
  { name: "Healthcare", note: "Intake, scheduling, and patient follow-up." },
  { name: "Home Services", note: "Call capture, dispatch, and job follow-through." },
  { name: "Professional Services", note: "Client intake, proposals, and delivery visibility." },
  { name: "Automotive", note: "Lead response, service scheduling, and retention." },
  { name: "Transportation", note: "Dispatch coordination and operational reporting." },
  { name: "Construction", note: "Estimating workflow, change orders, and project reporting." },
  { name: "Retail", note: "Customer reactivation and multi-location reporting." },
  { name: "Hospitality", note: "Booking response, reviews, and staffing coordination." },
  { name: "Legal", note: "Intake qualification, matter tracking, and follow-up." },
  { name: "Financial", note: "Lead qualification, compliance-aware workflows, and reporting." },
  { name: "Manufacturing", note: "Quoting, production visibility, and operational metrics." },
  { name: "Local Service Businesses", note: "Any operation where speed to response drives revenue." },
];

export const PROCESS_STEPS: { step: number; name: string; detail: string }[] = [
  {
    step: 1,
    name: "Request an Assessment",
    detail: "You tell us what is limiting growth. No pitch, no software demo.",
  },
  {
    step: 2,
    name: "Discovery",
    detail: "We review how the business actually operates: demand, sales, delivery, and reporting.",
  },
  {
    step: 3,
    name: "Initial Executive Assessment",
    detail: "We name the constraint, and the cost of leaving it in place.",
  },
  {
    step: 4,
    name: "Executive Growth Blueprint",
    detail: "A written plan: what to fix, in what order, and what result each step is meant to produce.",
  },
  {
    step: 5,
    name: "Proposal",
    detail: "Scope, investment, and timeline in writing. You decide with the full picture.",
  },
  {
    step: 6,
    name: "Implementation",
    detail: "We build and deploy the systems, with visible milestones throughout.",
  },
  {
    step: 7,
    name: "Optimization",
    detail: "We measure, tune, and keep improving the outcome after go live.",
  },
];

export const OUTCOMES: { label: string; detail: string }[] = [
  { label: "Revenue", detail: "More qualified conversations, and more of them converted." },
  { label: "Response Time", detail: "Inbound demand answered in minutes instead of days." },
  { label: "Efficiency", detail: "Manual work removed from the steps that do not need a person." },
  { label: "Operational Clarity", detail: "One truthful view of pipeline, delivery, and cash." },
];

export const WHY_US: { title: string; body: string }[] = [
  {
    title: "Built by operators",
    body: "We have run businesses. Our recommendations start from payroll and cash flow, not from a product roadmap.",
  },
  {
    title: "Revenue before features",
    body: "We sequence work by business impact. If it does not move a number, it does not go first.",
  },
  {
    title: "Implementation, not advice",
    body: "We do not deliver a slide deck and leave. We build, deploy, and stay accountable for the result.",
  },
  {
    title: "Measured in the open",
    body: "Clients get a working view of delivery progress, deliverables, and outcomes. No status theater.",
  },
];

export const BUSINESS_SIZES = [
  "1 to 5 employees",
  "6 to 20 employees",
  "21 to 50 employees",
  "51 to 200 employees",
  "200+ employees",
] as const;

export const REFERRAL_SOURCES = [
  "Referral",
  "Search",
  "Social",
  "Email",
  "Event",
  "Existing relationship",
  "Other",
] as const;