// Server-side action execution. Called from askSam AFTER the conversational
// answer is produced. Enforces autonomy/kill-switch state, org membership,
// and role gates. Returns a structured ActionReceipt embedded in the SAM
// assistant message metadata. NEVER claims execution when only analysis
// occurred: kind=none produces status=none, not "success".

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { detectSamAction, type DetectedAction } from "./detect";

type SB = SupabaseClient<Database>;

export type ActionStatus = "success" | "queued" | "blocked" | "failed" | "ambiguous" | "none";

export interface ActionReceipt {
  status: ActionStatus;
  kind: DetectedAction["kind"];
  explanation: string;
  ids: Record<string, string>;   // { missionId, workItemId, jobId, directiveId, ... }
  hrefs: Record<string, string>; // deep links into the app
  blockers: string[];
  detection: { confidence: number; reason: string };
}

function receipt(base: Partial<ActionReceipt> & Pick<ActionReceipt, "status" | "kind" | "explanation">): ActionReceipt {
  return {
    ids: {}, hrefs: {}, blockers: [], detection: { confidence: 0, reason: "" },
    ...base,
  };
}

async function readAutonomyState(supabase: SB, orgId: string): Promise<"active" | "paused" | "emergency_stopped"> {
  const { data } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { state: string } | null }> } } } })
    .from("sam_org_autonomy").select("state").eq("organization_id", orgId).maybeSingle();
  const s = data?.state;
  return (s === "paused" || s === "emergency_stopped") ? s : "active";
}

async function readRole(supabase: SB, orgId: string, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("organization_members").select("role, status")
    .eq("organization_id", orgId).eq("user_id", userId).maybeSingle();
  if (!data || data.status !== "active") return null;
  return data.role as string;
}

function roleAtLeast(role: string | null, min: "member" | "executive" | "admin" | "owner"): boolean {
  const order = ["viewer", "member", "executive", "admin", "owner"];
  if (!role) return false;
  return order.indexOf(role) >= order.indexOf(min);
}

async function writeActivity(
  supabase: SB, orgId: string, actor: string,
  action: string, entityType: string, entityId: string, summary: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await supabase.from("activity_events").insert({
    organization_id: orgId, actor_user_id: actor,
    action, entity_type: entityType, entity_id: entityId,
    summary, metadata: metadata as never,
  });
}

export interface ExecuteInput {
  supabase: SB;
  organizationId: string;
  userId: string;
  ventureId: string | null;
  message: string;
  conversationId: string;
}

export async function executeSamAction(input: ExecuteInput): Promise<ActionReceipt> {
  const detection = detectSamAction(input.message);
  if (detection.kind === "none") {
    return receipt({
      status: "none", kind: "none",
      explanation: "No operational intent detected; SAM responded conversationally.",
      detection: { confidence: 0, reason: detection.reason },
    });
  }

  const role = await readRole(input.supabase, input.organizationId, input.userId);
  if (!role) {
    return receipt({
      status: "blocked", kind: detection.kind, blockers: ["not a member of this organization"],
      explanation: "You are not an active member of this organization.",
      detection: { confidence: detection.confidence, reason: detection.reason },
    });
  }

  const state = await readAutonomyState(input.supabase, input.organizationId);
  const wantsControlChange = detection.kind === "pause_sam" || detection.kind === "resume_sam" || detection.kind === "emergency_stop";
  if (state !== "active" && !wantsControlChange) {
    return receipt({
      status: "blocked", kind: detection.kind, blockers: [`SAM is ${state}`],
      explanation: `SAM is currently ${state}. Resume SAM from /sam/control before issuing new missions.`,
      detection: { confidence: detection.confidence, reason: detection.reason },
    });
  }

  try {
    switch (detection.kind) {
      case "set_directive": {
        if (!roleAtLeast(role, "executive")) {
          return receipt({
            status: "blocked", kind: detection.kind, blockers: ["requires executive+ role"],
            explanation: "Only executives, admins, and owners can set standing directives.",
            detection,
          });
        }
        const text = (detection.title ?? input.message).slice(0, 2000);
        const { data, error } = await input.supabase
          .from("sam_directives" as never)
          .insert({
            organization_id: input.organizationId, venture_id: input.ventureId,
            text, scope: "permanent", priority: 100, status: "active",
            created_by: input.userId,
          } as never)
          .select("id" as never).single();
        if (error || !data) {
          return receipt({
            status: "failed", kind: detection.kind, blockers: [error?.message ?? "insert failed"],
            explanation: "Could not persist the directive.",
            detection,
          });
        }
        const directiveId = (data as unknown as { id: string }).id;
        await writeActivity(input.supabase, input.organizationId, input.userId,
          "sam_directive_created", "sam_directive", directiveId,
          `Directive: ${text.slice(0, 120)}`,
          { source: "chat", conversationId: input.conversationId });
        return receipt({
          status: "success", kind: detection.kind,
          ids: { directiveId },
          hrefs: { directives: "/sam" },
          explanation: `Standing directive recorded. SAM will include it on every future response and work-planning cycle.`,
          detection,
        });
      }

      case "create_mission":
      case "run_proof_mission": {
        const isProof = detection.kind === "run_proof_mission";
        // Idempotency for proof: reuse an active/recent proof mission for this
        // org rather than spawning duplicates on repeated commands.
        if (isProof) {
          const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
          const { data: existing } = await input.supabase
            .from("sam_missions" as never)
            .select("id, status" as never)
            .eq("organization_id", input.organizationId)
            .eq("source", "proof")
            .in("status", ["active", "draft"])
            .gte("created_at", cutoff)
            .order("created_at", { ascending: false })
            .limit(1) as unknown as { data: Array<{ id: string; status: string }> | null };
          if (existing && existing.length > 0) {
            const priorMissionId = existing[0].id;
            const { data: wi } = await input.supabase
              .from("sam_mission_work_items" as never)
              .select("id, automation_job_id" as never)
              .eq("mission_id", priorMissionId)
              .order("created_at", { ascending: true })
              .limit(1) as unknown as { data: Array<{ id: string; automation_job_id: string | null }> | null };
            const wiRow = wi?.[0];
            return receipt({
              status: "queued", kind: detection.kind,
              ids: {
                missionId: priorMissionId,
                ...(wiRow?.id ? { workItemId: wiRow.id } : {}),
                ...(wiRow?.automation_job_id ? { jobId: wiRow.automation_job_id } : {}),
              },
              hrefs: { mission: `/sam/missions/${priorMissionId}`, control: `/sam/control` },
              explanation: "An active proof mission already exists for this organization. Reusing it instead of creating a duplicate.",
              detection,
            });
          }
        }
        const title = isProof
          ? "SAM Proof Mission"
          : (detection.title ?? "New mission").slice(0, 200);
        // Insert mission
        const { data: missionRow, error: mErr } = await input.supabase
          .from("sam_missions" as never)
          .insert({
            organization_id: input.organizationId, venture_id: input.ventureId,
            title, description: isProof ? "Deterministic end-to-end proof of SAM execution." : input.message.slice(0, 4000),
            status: "active", priority: isProof ? 90 : 100,
            source: isProof ? "proof" : "chat", source_ref: input.conversationId,
            created_by: input.userId,
          } as never)
          .select("id" as never).single();
        if (mErr || !missionRow) {
          return receipt({
            status: "failed", kind: detection.kind, blockers: [mErr?.message ?? "mission insert failed"],
            explanation: "Could not create the mission.",
            detection,
          });
        }
        const missionId = (missionRow as unknown as { id: string }).id;

        // Create work item
        const workItemTitle = isProof
          ? "Produce qualified-prospect research brief"
          : `Kickoff plan: ${title}`;
        const { data: wiRow, error: wiErr } = await input.supabase
          .from("sam_mission_work_items" as never)
          .insert({
            mission_id: missionId, organization_id: input.organizationId,
            title: workItemTitle, status: "pending",
          } as never)
          .select("id" as never).single();
        if (wiErr || !wiRow) {
          return receipt({
            status: "failed", kind: detection.kind, blockers: [wiErr?.message ?? "work item insert failed"],
            explanation: "Mission was created but the first work item could not be recorded.",
            ids: { missionId },
            hrefs: { mission: `/sam/missions/${missionId}` },
            detection,
          });
        }
        const workItemId = (wiRow as unknown as { id: string }).id;

        await writeActivity(input.supabase, input.organizationId, input.userId,
          "sam_mission_created", "sam_mission", missionId,
          `Mission: ${title}`,
          { source: isProof ? "proof" : "chat", workItemId, conversationId: input.conversationId });

        // If proof mission: enqueue the deterministic job through the runtime.
        if (isProof) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { enqueueJob } = await import("@/lib/automation/queue.server");
            const scope = {
              organizationId: input.organizationId,
              ventureId: input.ventureId, assetId: null,
              integrationConnectionId: null, integrationSourceId: null,
              role: "member" as const, userId: input.userId,
            };
            const job = await enqueueJob(supabaseAdmin, scope, {
              jobType: "sam.proof_mission",
              ventureId: input.ventureId,
              triggerType: "manual",
              actorType: "user",
              priority: "high",
              idempotencyKey: `proof:${missionId}`,
              inputPayload: { missionId, workItemId },
            });
            await supabaseAdmin.from("sam_mission_work_items" as never)
              .update({ status: "queued", automation_job_id: job.id } as never)
              .eq("id", workItemId);
            return receipt({
              status: "queued", kind: detection.kind,
              ids: { missionId, workItemId, jobId: job.id },
              hrefs: {
                mission: `/sam/missions/${missionId}`,
                control: `/sam/control`,
              },
              explanation: "Proof mission queued. Watch the mission page as the worker transitions the job from queued to running to completed.",
              detection,
            });
          } catch (e) {
            return receipt({
              status: "blocked", kind: detection.kind,
              blockers: [(e as Error).message ?? "enqueue failed"],
              explanation: "Mission and work item created, but the execution job could not be queued. Check the automation runtime.",
              ids: { missionId, workItemId },
              hrefs: { mission: `/sam/missions/${missionId}` },
              detection,
            });
          }
        }

        return receipt({
          status: "success", kind: detection.kind,
          ids: { missionId, workItemId },
          hrefs: { mission: `/sam/missions/${missionId}` },
          explanation: "Mission recorded. SAM will draft next steps and surface required approvals on the mission page.",
          detection,
        });
      }

      case "pause_sam":
      case "resume_sam":
      case "emergency_stop": {
        const min = detection.kind === "emergency_stop" ? "owner" : "executive";
        if (!roleAtLeast(role, min)) {
          return receipt({
            status: "blocked", kind: detection.kind, blockers: [`requires ${min}+ role`],
            explanation: `Only ${min}+ can change SAM's operating state.`,
            hrefs: { control: `/sam/control` },
            detection,
          });
        }
        // Emergency stop from chat: require confirmation flow on /sam/control, not inline.
        if (detection.kind === "emergency_stop") {
          return receipt({
            status: "blocked", kind: detection.kind,
            blockers: ["emergency stop requires typed confirmation on the control panel"],
            explanation: "Emergency Stop must be confirmed on /sam/control by typing STOP. This prevents accidental shutdowns from chat.",
            hrefs: { control: `/sam/control` },
            detection,
          });
        }
        const nextState: "active" | "paused" = detection.kind === "pause_sam" ? "paused" : "active";
        const now = new Date().toISOString();
        const { error } = await input.supabase.from("sam_org_autonomy" as never)
          .upsert({
            organization_id: input.organizationId, state: nextState,
            reason: `set via chat`, changed_by: input.userId, changed_at: now,
          } as never, { onConflict: "organization_id" } as never);
        if (error) {
          return receipt({
            status: "failed", kind: detection.kind, blockers: [error.message],
            explanation: "Could not update SAM's operating state.",
            detection,
          });
        }
        await writeActivity(input.supabase, input.organizationId, input.userId,
          `sam_autonomy_${nextState}`, "sam_org_autonomy", input.organizationId,
          `SAM state -> ${nextState}`, { source: "chat" });
        return receipt({
          status: "success", kind: detection.kind,
          hrefs: { control: `/sam/control` },
          explanation: `SAM is now ${nextState}.`,
          detection,
        });
      }
    }
  } catch (e) {
    return receipt({
      status: "failed", kind: detection.kind,
      blockers: [(e as Error).message ?? "unexpected error"],
      explanation: "Execution failed unexpectedly. Details recorded in activity log.",
      detection,
    });
  }

  return receipt({
    status: "ambiguous", kind: detection.kind,
    explanation: "Detected intent but no execution path matched.",
    detection,
  });
}