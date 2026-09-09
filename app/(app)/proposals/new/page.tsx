"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  proposalIntakeSchema,
  type ProposalIntakeInput,
  SUPPORTING_TEXT_MAX,
  SUPPORTING_FILE_MAX_BYTES,
  SUPPORTING_FILE_ACCEPT,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

const FIELDS: Array<{
  name: keyof ProposalIntakeInput;
  label: string;
  type?: "text" | "email" | "date";
  multiline?: boolean;
}> = [
  { name: "clientName", label: "Client Name" },
  { name: "clientEmail", label: "Client Email", type: "email" },
  { name: "companyName", label: "Company Name" },
  { name: "dateOfCall", label: "Date of Call", type: "date" },
  { name: "salespersonName", label: "Salesperson Name" },
  { name: "clientNeedsSummary", label: "Summary of Client's Needs", multiline: true },
  { name: "projectScope", label: "Project Scope", multiline: true },
  { name: "goalsAndObjectives", label: "Goals and Objectives", multiline: true },
  {
    name: "recommendedServices",
    label: "Recommended Services or Deliverables",
    multiline: true,
  },
  { name: "proposedTimeline", label: "Proposed Timeline", multiline: true },
  { name: "estimatedPricing", label: "Estimated Pricing", multiline: true },
];

export default function NewProposalPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProposalIntakeInput>({
    resolver: zodResolver(proposalIntakeSchema),
  });

  const supportingText = watch("supportingText") ?? "";

  function buildFormData(values: ProposalIntakeInput, proceedWithoutFile: boolean) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (value) formData.set(key, value);
    });
    if (file) formData.set("supportingFile", file);
    if (proceedWithoutFile) formData.set("proceedWithoutFile", "true");
    return formData;
  }

  async function submitForm(
    values: ProposalIntakeInput,
    proceedWithoutFile = false,
  ) {
    setSubmitting(true);
    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        body: buildFormData(values, proceedWithoutFile),
      });

      if (response.status === 422) {
        const body = await response.json();
        if (body.error === "EXTRACTION_FAILED") {
          setExtractionMessage(body.message);
          setExtractionDialogOpen(true);
          setLastValues(values);
          return;
        }
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toast.error(body.message || "Couldn't generate the proposal — please try again.");
        return;
      }

      const { id } = await response.json();
      toast.success("Proposal generated.");
      router.push(`/proposals/${id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const [lastValues, setLastValues] = useState<ProposalIntakeInput | null>(null);

  function onFileChange(selected: File | null) {
    if (selected && selected.size > SUPPORTING_FILE_MAX_BYTES) {
      toast.error("File exceeds the 2MB limit.");
      return;
    }
    if (selected && !SUPPORTING_FILE_ACCEPT.includes(selected.type as never)) {
      toast.error("Unsupported file type. Use PDF, DOC, DOCX, or TXT.");
      return;
    }
    setFile(selected);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          New Proposal
        </h1>
        <p className="text-sm text-muted-foreground">
          All fields are required — Claude will draft the proposal from
          exactly what you provide here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Intake</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((values) => submitForm(values))}
            className="flex flex-col gap-5"
            noValidate
          >
            {FIELDS.map((field) => (
              <div key={field.name} className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>{field.label}</Label>
                {field.multiline ? (
                  <Textarea id={field.name} {...register(field.name)} />
                ) : (
                  <Input
                    id={field.name}
                    type={field.type ?? "text"}
                    {...register(field.name)}
                  />
                )}
                {errors[field.name] && (
                  <p className="text-sm text-danger">
                    {errors[field.name]?.message}
                  </p>
                )}
              </div>
            ))}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supportingText">
                Supporting Notes (optional)
              </Label>
              <Textarea
                id="supportingText"
                className="min-h-40"
                placeholder="Paste call notes, a transcript, or other context…"
                {...register("supportingText")}
              />
              <p className="text-xs text-muted-foreground">
                {supportingText.length.toLocaleString()} /{" "}
                {SUPPORTING_TEXT_MAX.toLocaleString()} characters
              </p>
              {errors.supportingText && (
                <p className="text-sm text-danger">
                  {errors.supportingText.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supportingFile">
                Supporting File (optional, PDF/DOC/DOCX/TXT, max 2MB)
              </Label>
              <input
                id="supportingFile"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </div>

            <Button type="submit" disabled={submitting} className="mt-2 self-start">
              {submitting ? "Generating…" : "Generate Proposal"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={extractionDialogOpen} onOpenChange={setExtractionDialogOpen}>
        <DialogContent>
          <DialogTitle>Couldn&apos;t read the uploaded file</DialogTitle>
          <DialogDescription className="mt-2">
            {extractionMessage} You can upload a different file, or continue
            without it.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFile(null)}
                >
                  Re-upload a different file
                </Button>
              }
            />
            <DialogClose
              render={
                <Button
                  type="button"
                  onClick={() => {
                    if (lastValues) submitForm(lastValues, true);
                  }}
                >
                  Proceed without this file
                </Button>
              }
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
