import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import northstarLogo from "@/assets/northstar-labs-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/labs/assessment-generator")({
  component: AssessmentGeneratorPage,
  head: () => ({ meta: [{ title: "Assessment Generator | NorthStar Labs" }] }),
});

type Form = {
  company: string; contact: string; industry: string; website: string; goals: string;
  acquisition: string; leadHandling: string; conversion: string; operations: string; measurement: string;
  monthlyLeads: string; monthlySpend: string; avgCustomerValue: string; responseTime: string;
  leadToAppointment: string; appointmentToCustomer: string; knownProblems: string; notes: string;
};

const empty: Form = { company:"",contact:"",industry:"",website:"",goals:"",acquisition:"",leadHandling:"",conversion:"",operations:"",measurement:"",monthlyLeads:"",monthlySpend:"",avgCustomerValue:"",responseTime:"",leadToAppointment:"",appointmentToCustomer:"",knownProblems:"",notes:"" };

function n(v: string) { const x = Number(v.replace(/[^0-9.]/g, "")); return Number.isFinite(x) ? x : 0; }
function pct(v: string) { const x = n(v); return x > 1 ? x / 100 : x; }
function money(v: number) { return new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(v); }

function AssessmentGeneratorPage() {
  const [form, setForm] = useState<Form>(empty);
  const [generated, setGenerated] = useState(false);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const metrics = useMemo(() => {
    const leads=n(form.monthlyLeads), spend=n(form.monthlySpend), value=n(form.avgCustomerValue), lta=pct(form.leadToAppointment), atc=pct(form.appointmentToCustomer);
    const customers = leads*lta*atc;
    return { cpl: leads ? spend/leads : 0, customers, revenue: customers*value };
  }, [form]);
  const areas = [
    ["Acquisition", form.acquisition], ["Lead Handling", form.leadHandling], ["Conversion", form.conversion],
    ["Operations & Automation", form.operations], ["Measurement & Revenue", form.measurement],
  ];
  const constraints = areas.filter(([,v]) => v.trim()).map(([k,v]) => `${k}: ${v}`);

  return <>
    <div className="print:hidden"><PageHeader eyebrow="NorthStar Labs" title="Assessment Generator" description="Enter what we know, then generate a consistent client-ready assessment." actions={<Button variant="outline" size="sm" asChild><Link to="/labs/assessments"><ArrowLeft className="mr-2 h-4 w-4"/>Requests</Link></Button>} /></div>
    <PageBody>
      <div className="print:hidden">
        <Section title="Client & goals"><div className="grid gap-4 md:grid-cols-2">{([['company','Company'],['contact','Primary contact'],['industry','Industry'],['website','Website']] as [keyof Form,string][]).map(([k,l])=><Field key={k} label={l} value={form[k]} onChange={(v)=>set(k,v)}/>)}</div><Area label="Business goals" value={form.goals} onChange={(v)=>set('goals',v)}/></Section>
        <Section title="Growth system"><div className="grid gap-4 md:grid-cols-2"><Area label="Acquisition" value={form.acquisition} onChange={(v)=>set('acquisition',v)}/><Area label="Lead handling" value={form.leadHandling} onChange={(v)=>set('leadHandling',v)}/><Area label="Conversion" value={form.conversion} onChange={(v)=>set('conversion',v)}/><Area label="Operations & automation" value={form.operations} onChange={(v)=>set('operations',v)}/><Area label="Measurement & revenue" value={form.measurement} onChange={(v)=>set('measurement',v)}/><Area label="Known problems / leaks" value={form.knownProblems} onChange={(v)=>set('knownProblems',v)}/></div></Section>
        <Section title="Known metrics" hint="Leave unknown fields blank"><div className="grid gap-4 md:grid-cols-3">{([['monthlyLeads','Monthly leads'],['monthlySpend','Monthly marketing spend'],['avgCustomerValue','Average customer value'],['responseTime','Average lead response time'],['leadToAppointment','Lead → appointment %'],['appointmentToCustomer','Appointment → customer %']] as [keyof Form,string][]).map(([k,l])=><Field key={k} label={l} value={form[k]} onChange={(v)=>set(k,v)}/>)}</div><Area label="Additional notes" value={form.notes} onChange={(v)=>set('notes',v)}/><Button className="mt-5" onClick={()=>setGenerated(true)}>Generate Assessment</Button></Section>
      </div>

      {generated && <div id="assessment-output" className="nsl-report mt-8 space-y-8 p-8 shadow-[0_24px_60px_-40px_oklch(0_0_0/0.5)] print:mt-0 print:space-y-6 print:p-0 print:shadow-none">
        <header className="border-b-2 border-primary pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={northstarLogo.url} alt="NorthStar Labs" className="h-12 w-auto" width={48} height={48} />
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[.22em] text-primary">NorthStar Labs</div>
                <h1 className="mt-1.5 font-display text-3xl font-semibold text-foreground">Growth Assessment</h1>
              </div>
            </div>
            <Button className="print:hidden" variant="outline" onClick={()=>window.print()}><Printer className="mr-2 h-4 w-4"/>Print / Save PDF</Button>
          </div>
          <p className="mt-4 text-[14px] text-muted-foreground">Prepared for <span className="font-medium text-foreground">{form.company || 'Client'}</span>{form.industry ? ` · ${form.industry}` : ''}{form.website ? ` · ${form.website}` : ''}</p>
        </header>
        <Report title="Executive Summary"><p>{form.company || 'This business'} is being assessed across acquisition, lead handling, conversion, operations, and revenue measurement. The purpose is to identify the highest-impact constraints, prioritize the fixes, and establish a measurable baseline before implementation.</p>{form.goals && <p className="mt-3"><strong>Primary goals:</strong> {form.goals}</p>}</Report>
        <Report title="Current State"><div className="grid gap-4 sm:grid-cols-2">{areas.map(([k,v])=><div key={k} className="break-inside-avoid border border-border p-4"><h3 className="text-[13px] font-semibold uppercase tracking-[.1em] text-primary">{k}</h3><p className="mt-1.5 text-sm text-muted-foreground">{v || 'Not enough information supplied yet.'}</p></div>)}</div></Report>
        <Report title="Primary Constraints & Leaks"><div className="nsl-report-panel p-5">{constraints.length ? <ul className="space-y-2">{constraints.map(x=><li key={x} className="flex gap-2"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 bg-primary"/><span>{x}</span></li>)}</ul> : <p>Insufficient information to name a constraint responsibly.</p>}{form.knownProblems && <p className="mt-3"><strong>Known leaks:</strong> {form.knownProblems}</p>}</div></Report>
        <Report title="Baseline Economics"><div className="grid gap-4 sm:grid-cols-3"><Metric label="Cost per lead" value={metrics.cpl ? money(metrics.cpl) : 'Unknown'}/><Metric label="Est. customers / month" value={metrics.customers ? metrics.customers.toFixed(1) : 'Unknown'}/><Metric label="Est. revenue from supplied funnel" value={metrics.revenue ? money(metrics.revenue) : 'Unknown'}/></div><p className="mt-3 text-xs text-muted-foreground">Calculated only from supplied inputs. These are baseline calculations, not promises or historical NorthStar results.</p></Report>
        <Report title="Priority Actions"><ol className="space-y-2"><li>1. Fix the highest-impact break in the lead-to-revenue path first.</li><li>2. Remove manual handoffs where they delay response or follow-up.</li><li>3. Connect activity to pipeline and revenue so the result can be measured.</li><li>4. Establish the baseline above before implementation and compare the same metrics after launch.</li></ol></Report>
        <Report title="NorthStar Implementation Plan"><p>Scope should follow the assessment, not a preset software package. NorthStar will use the smallest combination of acquisition, communication, automation, CRM, integration, and reporting infrastructure required to address the identified constraint.</p></Report>
        <Report title="Expected Outcomes"><p>Faster response, more consistent follow-up, fewer lost opportunities, less manual work, clearer pipeline visibility, and stronger revenue attribution. Specific targets should be set only after the baseline and implementation scope are confirmed.</p></Report>
        <Report title="Next Step"><div className="nsl-report-panel p-5"><p>Review the findings with the client, confirm the priority constraint and baseline, then issue the implementation scope with the exact work, investment, timeline, and success measures.</p></div></Report>
        <footer className="border-t border-border pt-4 text-[11px] text-muted-foreground">NorthStar Labs · Innovate. Automate. Elevate. · northstarlabshq.com</footer>
      </div>}

    </PageBody>
  </>;
}

function Field({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}) { return <label className="block"><span className="text-[11px] font-medium uppercase tracking-[.16em] text-muted-foreground">{label}</span><input className="mt-2 h-10 w-full border border-border bg-background px-3 text-sm" value={value} onChange={e=>onChange(e.target.value)}/></label>; }
function Area({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}) { return <label className="mt-4 block"><span className="text-[11px] font-medium uppercase tracking-[.16em] text-muted-foreground">{label}</span><Textarea className="mt-2" rows={4} value={value} onChange={e=>onChange(e.target.value)}/></label>; }
function Report({title,children}:{title:string;children:React.ReactNode}) { return <section className="break-inside-avoid"><h2 className="border-b border-primary/30 pb-2 font-display text-xl font-semibold text-primary">{title}</h2><div className="mt-4 text-[14px] leading-7 text-foreground">{children}</div></section>; }
function Metric({label,value}:{label:string;value:string}) { return <div className="nsl-report-panel break-inside-avoid p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-display text-xl font-semibold text-primary">{value}</div></div>; }
