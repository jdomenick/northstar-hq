// Pure heuristic detector that classifies a free-text SAM message into an
// operational intent. No LLM call — fast, deterministic, unit-testable.
// The detector NEVER executes anything. It only proposes a kind + a title
// extracted from the message. The server layer performs the real execution
// through executeSamAction() with full authorization checks.

export type SamActionKind =
  | "run_proof_mission"
  | "create_mission"
  | "set_directive"
  | "pause_sam"
  | "resume_sam"
  | "emergency_stop"
  | "none";

export interface DetectedAction {
  kind: SamActionKind;
  confidence: number; // 0..1
  title: string | null;
  reason: string;
}

const RE_PROOF = /\b(run|start|kick off|execute)\b.*\b(proof|sam proof|proof mission)\b/i;
const RE_PROOF2 = /\bsam[,:]?\s+prove\b/i;
const RE_EMERGENCY = /\b(emergency\s*stop|kill\s*switch|halt everything|stop everything|shut sam down)\b/i;
const RE_PAUSE = /\b(pause sam|pause yourself|pause automation|pause all sam)\b/i;
const RE_RESUME = /\b(resume sam|resume yourself|unpause sam|resume automation|start sam back up)\b/i;
const RE_DIRECTIVE = /^(sam[,:]?\s*)?(from now on|always|never|going forward|standing order|permanent(ly)?)\b/i;
const RE_MISSION = /^(sam[,:]?\s*)?(focus on|make .* the priority|work on|prioritize|create (a )?mission|start (a )?mission|get me (customers|clients|leads)|land (our|the) first|our next mission is|new mission)/i;
const RE_MISSION2 = /\b(get|land|acquire) .*(customers|clients|leads|deals|users)\b/i;

function cleanTitle(s: string, kind: SamActionKind): string {
  let t = s.trim().replace(/\s+/g, " ").replace(/^["'`]+|["'`]+$/g, "");
  // strip common prefixes so the mission title reads naturally
  t = t.replace(/^(sam[,:]?\s*)/i, "");
  if (kind === "create_mission") {
    t = t.replace(/^(focus on|work on|prioritize|create (a )?mission( to)?|start (a )?mission( to)?|new mission( to)?|our next mission is)\s*[:\-]?\s*/i, "");
    t = t.replace(/^please\s+/i, "");
  }
  if (kind === "set_directive") {
    t = t.replace(/^(from now on|always|never|going forward|standing order|permanent(ly)?)[,:\s]*/i, (m) => m);
  }
  return t.slice(0, 200);
}

export function detectSamAction(message: string): DetectedAction {
  const m = message.trim();
  if (!m) return { kind: "none", confidence: 0, title: null, reason: "empty" };
  if (RE_PROOF.test(m) || RE_PROOF2.test(m)) {
    return { kind: "run_proof_mission", confidence: 0.95, title: null, reason: "matched proof-mission phrase" };
  }
  if (RE_EMERGENCY.test(m)) {
    return { kind: "emergency_stop", confidence: 0.9, title: null, reason: "matched emergency-stop phrase" };
  }
  if (RE_PAUSE.test(m)) {
    return { kind: "pause_sam", confidence: 0.9, title: null, reason: "matched pause phrase" };
  }
  if (RE_RESUME.test(m)) {
    return { kind: "resume_sam", confidence: 0.9, title: null, reason: "matched resume phrase" };
  }
  if (RE_DIRECTIVE.test(m)) {
    return { kind: "set_directive", confidence: 0.75, title: cleanTitle(m, "set_directive"), reason: "matched directive phrase" };
  }
  if (RE_MISSION.test(m) || RE_MISSION2.test(m)) {
    return { kind: "create_mission", confidence: 0.8, title: cleanTitle(m, "create_mission"), reason: "matched mission phrase" };
  }
  return { kind: "none", confidence: 0, title: null, reason: "no operational intent detected" };
}