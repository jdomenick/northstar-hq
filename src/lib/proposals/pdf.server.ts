// Server-side PDF renderer using pdf-lib. Worker-safe: no filesystem or
// native binaries. Produces a NorthStar Labs branded, multi-page proposal
// PDF from a sanitized public payload.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import type { PublicProposal } from "./sanitize";

const MARGIN = 48;
const PAGE_W = 612;
const PAGE_H = 792;
const CONTENT_W = PAGE_W - MARGIN * 2;

const OBSIDIAN = rgb(0.06, 0.07, 0.11);
const INK = rgb(0.12, 0.14, 0.2);
const MUTED = rgb(0.42, 0.46, 0.55);
const ION = rgb(0.15, 0.44, 0.86);
const RULE = rgb(0.86, 0.88, 0.92);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  const paragraphs = (text ?? "").split(/\r?\n/);
  for (const p of paragraphs) {
    if (!p) { out.push(""); continue; }
    const words = p.split(/\s+/);
    let line = "";
    for (const w of words) {
      const attempt = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(attempt, size) > maxWidth && line) {
        out.push(line); line = w;
      } else {
        line = attempt;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export async function renderProposalPdf(p: PublicProposal): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(p.title);
  doc.setCreator("NorthStar Labs");
  doc.setProducer("NorthStar Labs Proposals");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    drawHeader();
  };

  const drawHeader = () => {
    page.drawText("NORTHSTAR LABS", { x: MARGIN, y: PAGE_H - 28, size: 9, font: bold, color: ION });
    page.drawText(p.proposal_number, { x: PAGE_W - MARGIN - bold.widthOfTextAtSize(p.proposal_number, 9), y: PAGE_H - 28, size: 9, font: bold, color: MUTED });
    page.drawLine({ start: { x: MARGIN, y: PAGE_H - 34 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 34 }, thickness: 0.5, color: RULE });
  };

  const ensure = (needed: number) => { if (y - needed < MARGIN + 20) newPage(); };

  const writeParagraph = (text: string, size = 10.5, font = regular, color = INK, gap = 4) => {
    const lines = wrap(text || "", font, size, CONTENT_W);
    const lh = size * 1.35;
    for (const line of lines) {
      ensure(lh);
      page.drawText(line, { x: MARGIN, y: y - size, size, font, color });
      y -= lh;
    }
    y -= gap;
  };

  const heading = (label: string) => {
    ensure(40);
    y -= 8;
    page.drawText(label.toUpperCase(), { x: MARGIN, y: y - 10, size: 10, font: bold, color: ION });
    y -= 14;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 40, y }, thickness: 1.2, color: ION });
    y -= 14;
  };

  // Cover page
  page.drawRectangle({ x: 0, y: PAGE_H - 140, width: PAGE_W, height: 140, color: OBSIDIAN });
  page.drawText("NORTHSTAR LABS", { x: MARGIN, y: PAGE_H - 60, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Engagement Proposal", { x: MARGIN, y: PAGE_H - 90, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText(p.proposal_number, { x: MARGIN, y: PAGE_H - 115, size: 11, font: regular, color: rgb(0.75, 0.8, 0.9) });
  y = PAGE_H - 180;

  page.drawText(p.title, { x: MARGIN, y, size: 20, font: bold, color: OBSIDIAN });
  y -= 34;
  page.drawText(`Prepared for: ${p.client_name}`, { x: MARGIN, y, size: 12, font: regular, color: INK });
  y -= 18;
  page.drawText(`Prepared by: NorthStar Labs`, { x: MARGIN, y, size: 12, font: regular, color: INK });
  y -= 18;
  page.drawText(`Prepared on: ${new Date(p.prepared_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`, { x: MARGIN, y, size: 12, font: regular, color: MUTED });
  y -= 32;

  const sections: Array<[string, string]> = [
    ["Executive Summary", p.executive_summary],
    ["Business Overview", p.business_overview],
    ["Current Business Challenges", p.current_challenges],
    ["Executive Assessment Summary", p.assessment_summary],
    ["Growth Opportunities", p.growth_opportunities],
    ["Recommended Strategy", p.recommended_strategy],
    ["Recommended Services", p.recommended_services],
    ["Deliverables", p.deliverables],
    ["Implementation Timeline", p.implementation_timeline],
  ];
  for (const [label, body] of sections) {
    heading(label);
    writeParagraph(body || "[Needs input]");
  }

  // Investment table
  heading("Investment");
  const rows: Array<[string, string]> = [
    ["Total engagement value", fmtMoney(p.total_value_cents)],
    ["One-time setup fee", fmtMoney(p.setup_fee_cents)],
    ["Recurring monthly", fmtMoney(p.recurring_fee_cents)],
  ];
  for (const [label, value] of rows) {
    ensure(18);
    page.drawText(label, { x: MARGIN, y: y - 10, size: 10.5, font: regular, color: INK });
    const vw = bold.widthOfTextAtSize(value, 10.5);
    page.drawText(value, { x: PAGE_W - MARGIN - vw, y: y - 10, size: 10.5, font: bold, color: OBSIDIAN });
    y -= 16;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.4, color: RULE });
    y -= 4;
  }
  writeParagraph(p.investment_summary || "", 10, regular, MUTED, 10);

  heading("Payment Schedule");
  writeParagraph(p.payment_schedule || "[Needs input]");

  heading("Terms and Conditions");
  writeParagraph(p.terms || "");

  heading("Acceptance");
  if (p.acceptance) {
    writeParagraph(`Signed by: ${p.acceptance.signer_name}`);
    writeParagraph(`Email: ${p.acceptance.signer_email}`);
    writeParagraph(`Acknowledgement: ${p.acceptance.acknowledgement}`);
    writeParagraph(`Signed at: ${new Date(p.acceptance.signed_at).toUTCString()}`);
    writeParagraph(`Proposal version at signing: v${p.acceptance.proposal_version}`);
    writeParagraph(`Proposal ID: ${p.proposal_number}`);
  } else {
    writeParagraph("By accepting through the secure client link, the signer confirms authority to bind the client organization to the scope, timeline, and investment above.");
  }

  // Footer page numbers
  const total = doc.getPageCount();
  doc.getPages().forEach((pg, idx) => {
    const label = `Page ${idx + 1} of ${total} - NorthStar Labs`;
    pg.drawText(label, { x: MARGIN, y: 24, size: 8, font: regular, color: MUTED });
  });

  return await doc.save();
}