# Executive Data Flow: Asset Model

Status: adopted in Phase 3D.2b.

## Hierarchy

NorthStar Labs is an Executive Operating System, not a website manager. The
long-term data flow is:

```
Organization
  -> Venture
    -> Asset
      -> Integration
        -> Signal
          -> Knowledge
            -> Memory
              -> SAM
```

Every venture owns Assets. Every Asset can have zero or more Integrations
that produce Signals. Signals may be promoted into Knowledge by the
Intelligence Center. Knowledge feeds Memory. Memory feeds SAM.

## Why Asset is the primary abstraction

A Website is not a first-class concept; it is one Asset Type. Ventures
own many kinds of Assets:

- Healing Path: Website, Application, Supabase, App Store, Documentation,
  Marketing, Social Media, Customer Feedback, Analytics, Knowledge,
  Financial, Legal.
- Warpath: Website, App, Podcast, YouTube, Zoom, Courses, Books, Events,
  Community, Documents.
- Elite Fleet: Website, Reservation System, Vehicles, Drivers, DOT, CRM,
  Insurance, Marketing, Accounting.

Modelling everything as an Asset lets one abstraction cover Stripe, GitHub,
Gmail, Beehiiv, Notion, Google Drive, Slack, Facebook, Instagram, LinkedIn,
Analytics, Supabase, QuickBooks, Shopify, Twilio, and any future connector.
Asset Types are stored in the `asset_types` lookup table and are extensible;
they are never hardcoded in application code.

## Why Signals precede Knowledge

A Signal is a meaningful observation, not a fact. Examples:

- Website changed
- Pricing changed
- New documentation
- Failed synchronization
- Spike in traffic
- Drop in subscriptions
- New customer feedback
- Failed deployment
- Product review received
- Analytics anomaly

Signals are evidence that MAY become Knowledge. Promoting a Signal to
Knowledge is an intentional act - either an operator action in the
Intelligence Center, or a policy-driven auto-promotion for high-trust
sources. Keeping Signals distinct from Knowledge means:

1. Raw observation is preserved forever, even when rejected as knowledge.
2. SAM can reason about "what has changed lately" independently of
   "what do we know".
3. Contradictions surface at the Signal layer before they poison Memory.
4. Automation policies can be tuned per Asset without changing what SAM
   trusts.

## Intelligence Center

The operational review center for Signals is called the Intelligence
Center (previously referred to as the "Knowledge Inbox"). It will
eventually surface:

- New Signals
- Changed Signals
- Conflicts
- Failed imports
- Review queue
- Auto-processed items
- Stale intelligence
- Archived intelligence

Only the naming and future architecture references are in place today.
No Intelligence Center UI ships in 3D.2b.

## Backward compatibility

The existing Website connector, integration schema, RLS, audit, and routes
are unchanged. Existing website connections are backfilled with a matching
Website Asset via a one-time migration step; `integration_connections`
gains an optional `asset_id` link so future connectors slot into the same
abstraction without a rewrite.