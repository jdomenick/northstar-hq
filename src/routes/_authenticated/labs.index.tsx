import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useOrg } from "@/lib/org-context";
import { NslBriefPanel } from "@/components/nsl-brief";
import { runIntelligenceSweep } from "@/lib/sam/intelligence/intelligence.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/labs/")({
  component: BriefPage,
  head: () => ({
    meta: [
      { title: "The Brief | NorthStar Labs" },
      { name: "description", content: "One-page executive summary of revenue, pipeline, delivery, risk, and the one thing SAM believes matters most today." },
      { property: "og:title", content: "The Brief | NorthStar Labs" },
      { property: "og:description", content: "One-page executive summary of revenue, pipeline, delivery, risk, and the one thing SAM believes matters most today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function BriefPage() {
  const { activeOrgId } = useOrg();
  const qc = useQueryClient();
  const sweep = useServerFn(runIntelligenceSweep);
  const [sweepPending, setSweepPending] = useState(false);

  const onRunSweep = async () => {
    if (!activeOrgId) return;
    setSweepPending(true);
    try {
      const res = await sweep({ data: { organizationId: activeOrgId } });
      await qc.invalidateQueries({ queryKey: ["nsl-brief"] });
      toast.success(`Brief refreshed: ${res.insightsPersisted} insights, ${res.recommendationsPersisted} actions.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setSweepPending(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 md:px-10 md:py-10">
      <div className="mx-auto max-w-6xl">
        <NslBriefPanel organizationId={activeOrgId} onRunSweep={onRunSweep} sweepPending={sweepPending} />
      </div>
    </div>
  );
}
