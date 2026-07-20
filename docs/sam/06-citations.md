# 06  -  Citation Architecture

If SAM cannot cite it, SAM does not claim it. Every recommendation and
every non-trivial statement carries `Citation[]`. Citations point to real
NorthStar Labs records and deep-link into the app.

## Citation record

```
Citation {
  id: uuid
  claimId: string
  kind: 'direct' | 'supporting' | 'assumption' | 'inference'
  entity: {
    type: 'decision' | 'commitment' | 'project' | 'task' | 'goal'
          | 'knowledge_record' | 'document' | 'meeting' | 'risk' | 'rule'
    id: uuid
    orgId: uuid
    ventureId?: uuid
    title: string
    href: string
  }
  excerpt?: string
  strength: number                 // 0..1
  createdAt: timestamptz
}
```

## Citation kinds

| Kind | Meaning | Example |
| --- | --- | --- |
| `direct` | Cited record asserts the claim. | "Commitment #12 is overdue" cites Commitment #12. |
| `supporting` | Adds weight but does not prove. | Document supports a market assumption. |
| `assumption` | SAM asserts something not directly recorded; cite what SAM is assuming. | "Assuming Q4 target unchanged" cites the current Goal. |
| `inference` | Derived via a documented rule. | "Project stalled" cites project + rule id `stalled_project_v1`. |

## Rules

1. Every recommendation has at least one `direct` or `supporting` citation, otherwise the Recommendation Engine drops it.
2. Assumptions are explicit and user-correctable.
3. Inferences name the rule via a synthetic `rule` entity with a stable href to the rule's documentation.
4. Citations are per-claim, not per-response.
5. Deep links respect RLS  -  `href` always resolves inside the caller's org.
6. Excerpts are verbatim, never paraphrased.

## Response wiring

```
headline: "Two commitments to reschedule this week [c1,c2]"
why:
  - "Overdue commitment '{title}' is blocking Project X [c1,c3]"
  - "Founder prefers Fridays for admin work [c4]"
citations:
  c1: { kind: 'direct',     entity: Commitment#… }
  c2: { kind: 'direct',     entity: Commitment#… }
  c3: { kind: 'supporting', entity: Project#… }
  c4: { kind: 'direct',     entity: Preference memory row }
```

## Extensibility

- New entity types register a `Citable` adapter producing `{ title, href, excerpt? }`.
- Future evidence sources (Meeting transcripts, external documents) plug in without changing the Citation shape.