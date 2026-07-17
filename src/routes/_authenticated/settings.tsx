import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Section } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Northstar" },
      { name: "description", content: "Personal, workspace, and Operator preferences." },
    ],
  }),
});

function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Preferences" description="Tune how Northstar and Operator work for you." />
      <PageBody>
        <Section title="Profile">
          <Row label="Name" value="Jeff Carter" />
          <Row label="Email" value="jeff@northstar.app" />
          <Row label="Role" value="Founder" />
        </Section>
        <Section title="Operator">
          <Row label="Daily briefing" value="Every morning at 6:30 AM" />
          <Row label="Tone" value="Direct. No filler." />
          <Row label="Autonomy" value="Draft only — never send" />
        </Section>
        <Section title="Workspace">
          <Row label="Ventures" value="4 active" />
          <Row label="Members" value="7" />
          <Row label="Plan" value="Executive" />
        </Section>
      </PageBody>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,200px)_1fr] items-center gap-8 border-b border-border/60 py-5 text-[14px] last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}