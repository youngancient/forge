import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { withRetry } from "@/lib/retry";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.5 },
  title: { fontSize: 20, marginBottom: 10 },
  meta: { fontSize: 10, color: "#52525b", marginBottom: 2 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 13, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  body: { fontSize: 11 },
});

export interface ProposalPdfInput {
  clientName: string;
  companyName: string;
  preparedByName: string;
  preparedByEmail: string;
  dateOfCall: string;
  introduction: string;
  proposedSolution: string;
  deliverables: string;
  timeline: string;
  pricing: string;
  nextSteps: string;
}

// Structure follows artifact/proposal-template.md (design.md decision).
function ProposalDocument(p: ProposalPdfInput) {
  const sections: Array<[string, string]> = [
    ["Introduction", p.introduction],
    ["Proposed Solution", p.proposedSolution],
    ["Deliverables", p.deliverables],
    ["Timeline", p.timeline],
    ["Pricing", p.pricing],
    ["Next Steps", p.nextSteps],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Proposal for {p.clientName}</Text>
        <Text style={styles.meta}>
          Prepared by {p.preparedByName} &lt;{p.preparedByEmail}&gt;
        </Text>
        <Text style={styles.meta}>Date: {p.dateOfCall}</Text>

        {sections.map(([title, body]) => (
          <View key={title} style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

// Rendered fresh on every export/attach request — a deterministic template
// render from already-immutable (post-approval) section content, so no
// persistent storage is needed. Revised 2026-09-11 to drop Vercel Blob as a
// dependency (see design.md decisions #4/#14) — retried on transient failure
// like the other external calls (decision #16).
export async function generateProposalPdf(
  input: ProposalPdfInput,
): Promise<Buffer> {
  return withRetry(() => renderToBuffer(<ProposalDocument {...input} />));
}

// Shared by the export route and the send-with-attachment path so the
// sectionKey -> ProposalPdfInput mapping only lives in one place.
export function buildProposalPdfInput(
  proposal: {
    clientName: string;
    companyName: string;
    dateOfCall: Date;
    owner: { name: string; email: string };
  },
  sections: { sectionKey: string; content: string }[],
): ProposalPdfInput {
  const section = (key: string) =>
    sections.find((s) => s.sectionKey === key)?.content ?? "";
  return {
    clientName: proposal.clientName,
    companyName: proposal.companyName,
    preparedByName: proposal.owner.name,
    preparedByEmail: proposal.owner.email,
    dateOfCall: proposal.dateOfCall.toDateString(),
    introduction: section("INTRODUCTION"),
    proposedSolution: section("PROPOSED_SOLUTION"),
    deliverables: section("DELIVERABLES"),
    timeline: section("TIMELINE"),
    pricing: section("PRICING"),
    nextSteps: section("NEXT_STEPS"),
  };
}
