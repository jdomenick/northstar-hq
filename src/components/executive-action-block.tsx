import { Link } from "@tanstack/react-router";
import type { ExecutiveAction } from "@/lib/integrations/executive-action";

function healthTone(h: ExecutiveAction["health"]) {
  switch (h) {
    case "healthy":
      return {
        dot: "bg-[oklch(0.72_0.14_155)]",
        text: "text-[oklch(0.55_0.14_155)]",
        border: "border-[oklch(0.72_0.14_155)]/30",
        bg: "bg-[oklch(0.72_0.14_155)]/5",
        label: "Healthy",
      };
    case "warning":
      return {
        dot: "bg-[oklch(0.75_0.15_75)]",
        text: "text-[oklch(0.6_0.15_75)]",
        border: "border-[oklch(0.75_0.15_75)]/30",
        bg: "bg-[oklch(0.75_0.15_75)]/5",
        label: "Warning",
      };
    case "error":
      return {
        dot: "bg-[oklch(0.5_0.18_27)]",
        text: "text-[oklch(0.5_0.18_27)]",
        border: "border-[oklch(0.5_0.18_27)]/30",
        bg: "bg-[oklch(0.5_0.18_27)]/5",
        label: "Error",
      };
  }
}

function impactLabel(i: ExecutiveAction["impact"]) {
  if (!i) return null;
  return i === "high" ? "High impact" : i === "medium" ? "Medium impact" : "Low impact";
}

export function ExecutiveActionBlock({
  action,
  variant = "card",
}: {
  action: ExecutiveAction;
  variant?: "card" | "drawer";
}) {
  const tone = healthTone(action.health);
  const compact = variant === "card";

  return (
    <div
      className={`rounded-md border px-3 py-2.5 ${tone.border} ${tone.bg}`}
      aria-label="Executive action"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
          <span className={`text-[10.5px] font-medium uppercase tracking-wider ${tone.text}`}>
            Executive action
          </span>
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            {tone.label}
          </span>
        </div>
        {action.impact ? (
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            {impactLabel(action.impact)}
          </span>
        ) : null}
      </div>

      {action.actionRequired ? (
        <div className="mt-2">
          <div className={`text-[13px] font-medium ${tone.text}`}>
            {action.title}
          </div>
          {action.issue ? (
            <div className="mt-1 text-[12px] text-foreground/85">{action.issue}</div>
          ) : null}
          {action.nextStep && !compact ? (
            <div className="mt-2 text-[12px] text-muted-foreground">
              <span className="text-foreground/70">Next step:</span> {action.nextStep}
            </div>
          ) : null}
          {action.nextStep && compact ? (
            <div className="mt-1 text-[11.5px] text-muted-foreground">
              Next: {action.nextStep}
            </div>
          ) : null}
          {action.href ? (
            <Link
              to={action.href}
              className="mt-2 inline-block text-[11.5px] text-primary hover:underline"
            >
              Go to fix
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="mt-1.5 text-[12.5px] text-foreground/80">No action required.</div>
      )}
    </div>
  );
}