import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Inbox, Plus } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { listAssessmentRequests, updateAssessmentRequest } from "@/lib/marketing/assessments.functions";

export const Route = createFileRoute("/_authenticated/labs/assessments")({ component: AssessmentsPage, head: () => ({ meta: [{ title: "Assessment Requests | NorthStar Labs" }, { name: "description", content: "Review and qualify Assessment requests submitted from the NorthStar Labs website." }] }) });

const STATUS_TONE: Record<string,string>={new:"bg-primary/10 text-primary",reviewed:"bg-sky-500/10 text-sky-600",converted:"bg-emerald-500/10 text-emerald-600",archived:"bg-muted text-muted-foreground"};
const NOTIFICATION_TONE: Record<string,string>={pending:"bg-muted text-muted-foreground",not_configured:"bg-muted text-muted-foreground",sent:"bg-emerald-500/10 text-emerald-600",failed:"bg-destructive/10 text-destructive"};
const NOTIFICATION_LABEL: Record<string,string>={pending:"Notification pending",not_configured:"Notification not configured",sent:"Operator notified",failed:"Notification failed"};
function fmt(value:string){return new Date(value).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}

function AssessmentsPage(){
 const qc=useQueryClient(), listFn=useServerFn(listAssessmentRequests), updateFn=useServerFn(updateAssessmentRequest); const [filter,setFilter]=useState<"open"|"all">("open");
 const list=useQuery({queryKey:["nsl-assessments"],queryFn:()=>listFn()});
 const update=useMutation({mutationFn:(input:{id:string;status?:"new"|"reviewed"|"archived";operatorNotes?:string})=>updateFn({data:input}),onSuccess:()=>{void qc.invalidateQueries({queryKey:["nsl-assessments"]});toast.success("Request updated.");},onError:(e:Error)=>toast.error(e.message)});
 const rows=list.data??[], visible=useMemo(()=>filter==="all"?rows:rows.filter(r=>r.status!=="archived"),[rows,filter]), newCount=rows.filter(r=>r.status==="new").length;
 return <><PageHeader eyebrow="Pipeline intake" title="Assessments" description="Website requests and internal assessments in one workflow." actions={<div className="flex gap-2"><Button size="sm" asChild><Link to="/labs/assessment-generator"><Plus className="mr-2 h-4 w-4"/>New assessment</Link></Button><Button variant="outline" size="sm" onClick={()=>setFilter(filter==="open"?"all":"open")}>{filter==="open"?"Show all":"Show open only"}</Button></div>}/><PageBody><Section title="Website requests" hint={list.isLoading?"Loading":`${visible.length} shown · ${newCount} new`}>
 {list.isError&&<p className="text-[13px] text-destructive">Could not load requests. {(list.error as Error).message}</p>}
 {!list.isLoading&&!list.isError&&visible.length===0&&<div className="flex flex-col items-start gap-2 border border-dashed border-border p-8"><Inbox className="h-5 w-5 text-muted-foreground"/><p className="text-[14px]">No requests to review.</p><p className="text-[13px] text-muted-foreground">New website submissions appear here immediately. Use New assessment for a business you are assessing directly.</p></div>}
 <div className="space-y-4">{visible.map(r=><RequestCard key={r.id} row={r} saving={update.isPending} onUpdate={input=>update.mutate({id:r.id,...input})}/>)}</div>
 </Section></PageBody></>;
}

type Row={id:string;created_at:string;full_name:string;company:string;email:string;phone:string|null;website:string|null;industry:string|null;business_size:string|null;biggest_challenge:string;referral_source:string|null;status:string;operator_notes:string|null;notification_status:string;revenue_client_id:string|null;proposal_id:string|null};
function RequestCard({row,saving,onUpdate}:{row:Row;saving:boolean;onUpdate:(input:{status?:"new"|"reviewed"|"archived";operatorNotes?:string})=>void}){const[notes,setNotes]=useState(row.operator_notes??"");const dirty=notes!==(row.operator_notes??"");return <article className="surface-elevated p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-display text-[17px] font-semibold">{row.company}</h3><p className="mt-0.5 text-[13px] text-muted-foreground">{row.full_name} · {fmt(row.created_at)}</p></div><div className="flex flex-wrap items-center gap-2"><Badge className={STATUS_TONE[row.status]??"bg-muted"} variant="secondary">{row.status}</Badge><Badge className={NOTIFICATION_TONE[row.notification_status]??"bg-muted"} variant="secondary">{NOTIFICATION_LABEL[row.notification_status]??row.notification_status}</Badge>{row.proposal_id&&<Badge className="bg-emerald-500/10 text-emerald-600" variant="secondary">Proposal started</Badge>}<Button size="sm" asChild><Link to="/labs/assessment/$id" params={{id:row.id}}>{row.status==="new"?"Review":"Open"}</Link></Button>{row.status==="new"&&<Button size="sm" variant="outline" disabled={saving} onClick={()=>onUpdate({status:"reviewed"})}>Mark reviewed</Button>}</div></div>
 <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4"><Detail label="Email" value={<a className="underline underline-offset-4" href={`mailto:${row.email}`}>{row.email}</a>}/><Detail label="Phone" value={row.phone??"Not provided"}/><Detail label="Industry" value={row.industry??"Not provided"}/><Detail label="Business size" value={row.business_size??"Not provided"}/><Detail label="Website" value={row.website??"Not provided"}/><Detail label="Referral source" value={row.referral_source??"Not provided"}/></dl>
 <div className="mt-4"><div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Biggest challenge</div><p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-[1.7]">{row.biggest_challenge}</p></div>
 <div className="mt-4"><label htmlFor={`notes-${row.id}`} className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Operator notes</label><Textarea id={`notes-${row.id}`} value={notes} onChange={e=>setNotes(e.target.value)} rows={3} maxLength={4000} className="mt-2" placeholder="Context, next action, or why this was disqualified."/><Button className="mt-3" size="sm" disabled={!dirty||saving} onClick={()=>onUpdate({operatorNotes:notes})}>Save notes</Button></div></article>}
function Detail({label,value}:{label:string;value:React.ReactNode}){return <div><dt className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</dt><dd className="mt-1 truncate">{value}</dd></div>}
