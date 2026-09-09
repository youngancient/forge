import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { withRetry } from "@/lib/retry";
import { uploadBlob } from "@/lib/blob";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.5 },
  title: { fontSize: 20, marginBottom: 4 },
  meta: { fontSize: 10, color: "#52525b", marginBottom: 2 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 13, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  body: { fontSize: 11 },
});

export interface ProposalPdfInput {
  clientName: string;
  companyName: string;
  salespersonName: string;
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
    ["1. Introduction", p.introduction],
    ["2. Proposed Solution", p.proposedSolution],
    ["3. Deliverables", p.deliverables],
    ["4. Timeline", p.timeline],
    ["5. Pricing", p.pricing],
    ["6. Next Steps", p.nextSteps],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Proposal for {p.clientName}</Text>
        <Text style={styles.meta}>Prepared by {p.salespersonName}</Text>
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

// Generated once at approval and reused thereafter (design.md decision #4) —
// retried on transient failure like the other external calls (decision #16).
export async function generateProposalPdf(
  proposalId: string,
  input: ProposalPdfInput,
): Promise<string> {
  const buffer = await withRetry(() => renderToBuffer(<ProposalDocument {...input} />));
  return uploadBlob(`proposals/${proposalId}.pdf`, buffer, "application/pdf");
}
