import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProposalsTool from "./tools/list-proposals";
import listAssessmentRequestsTool from "./tools/list-assessment-requests";
import listProjectsTool from "./tools/list-projects";
import billingSummaryTool from "./tools/billing-summary";
import updateAssessmentRequestTool from "./tools/update-assessment-request";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "northstar-labs",
  title: "Northstar Labs",
  version: "0.1.0",
  instructions:
    "Tools for the NorthStar Labs operating platform. Read proposals, inbound assessment requests, delivery projects, and billing totals, and update the review state of an assessment request. All access runs as the signed-in NorthStar Labs user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProposalsTool,
    listAssessmentRequestsTool,
    listProjectsTool,
    billingSummaryTool,
    updateAssessmentRequestTool,
  ],
});
