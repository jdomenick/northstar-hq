// Company Constitution loader (org-specific layer on top of SAM Core).
//
// The Core Constitution in ./constitution.ts is constant across every
// organization. This module returns an optional per-org overlay defining
// voice, culture, and operating standards. It cannot override the
// non-negotiable PRINCIPLES in the Core.
//
// Storage is intentionally not wired to a table yet. When we're ready to
// let founders (and eventually licensees) author their own, add an
// `organization_settings.company_constitution` text column and read it
// here. Until then this returns null and the pipeline runs on Core alone.

export async function getCompanyConstitution(
  _orgId: string,
): Promise<string | null> {
  return null;
}