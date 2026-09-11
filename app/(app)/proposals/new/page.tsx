"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  proposalIntakeSchema,
  type ProposalIntakeInput,
  SUPPORTING_TEXT_MAX,
  SUPPORTING_FILE_MAX_BYTES,
  SUPPORTING_FILE_ACCEPT,
  NAME_MAX,
  EMAIL_MAX,
  DATE_MAX,
  NARRATIVE_FIELD_MAX,
} from "@/lib/validations";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
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
  maxLength: number;
}> = [
  { name: "clientName", label: "Client Name", maxLength: NAME_MAX },
  { name: "clientEmail", label: "Client Email", type: "email", maxLength: EMAIL_MAX },
  { name: "companyName", label: "Company Name", maxLength: NAME_MAX },
  { name: "dateOfCall", label: "Date of Call", type: "date", maxLength: DATE_MAX },
  { name: "salespersonName", label: "Salesperson Name", maxLength: NAME_MAX },
  {
    name: "clientNeedsSummary",
    label: "Summary of Client's Needs",
    multiline: true,
    maxLength: NARRATIVE_FIELD_MAX,
  },
  {
    name: "projectScope",
    label: "Project Scope",
    multiline: true,
    maxLength: NARRATIVE_FIELD_MAX,
  },
  {
    name: "goalsAndObjectives",
    label: "Goals and Objectives",
    multiline: true,
    maxLength: NARRATIVE_FIELD_MAX,
  },
  {
    name: "recommendedServices",
    label: "Recommended Services or Deliverables",
    multiline: true,
    maxLength: NARRATIVE_FIELD_MAX,
  },
  {
    name: "proposedTimeline",
    label: "Proposed Timeline",
    multiline: true,
    maxLength: NARRATIVE_FIELD_MAX,
  },
  {
    name: "estimatedPricing",
    label: "Estimated Pricing",
    multiline: true,
    maxLength: NARRATIVE_FIELD_MAX,
  },
];

export default function NewProposalPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState("");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProposalIntakeInput>({
    resolver: zodResolver(proposalIntakeSchema),
  });

  const values = watch();
  const supportingText = values.supportingText ?? "";

  useEffect(() => {
    if (!submitting) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submitting]);

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
        toast.error(
          body.message || "Couldn't generate the proposal — please try again.",
        );
        // The intake was saved even though generation failed — send them to
        // the proposal so they can retry rather than stranding them here.
        if (body.error === "GENERATION_FAILED" && body.proposalId) {
          router.push(`/proposals/${body.proposalId}`);
        }
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

  function goBack() {
    // Always the dashboard, not browser history — router.back() could land
    // on a stale cached view of a page that changed since it was last
    // visited (e.g. the dashboard, right after this page just created a
    // proposal). router.refresh() forces a real refetch instead of serving
    // Next's client Router Cache.
    router.push("/dashboard");
    router.refresh();
  }

  function handleBackClick() {
    if (submitting) setLeaveConfirmOpen(true);
    else goBack();
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 self-start"
        onClick={handleBackClick}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

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
                  <Textarea
                    id={field.name}
                    disabled={submitting}
                    maxLength={field.maxLength}
                    {...register(field.name)}
                  />
                ) : (
                  <Input
                    id={field.name}
                    type={field.type ?? "text"}
                    disabled={submitting}
                    maxLength={field.maxLength}
                    onClick={
                      field.type === "date"
                        ? (e) => e.currentTarget.showPicker?.()
                        : undefined
                    }
                    {...register(field.name)}
                  />
                )}
                {field.multiline && (
                  <p className="text-xs text-muted-foreground">
                    {(values[field.name] ?? "").length.toLocaleString()} /{" "}
                    {field.maxLength.toLocaleString()} characters
                  </p>
                )}
                {errors[field.name] && (
                  <p className="text-sm text-danger">
                    {errors[field.name]?.message}
                  </p>
                )}
              </div>
            ))}

            <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Supporting Material
                </h2>
                <p className="text-xs text-muted-foreground">
                  Optional — paste notes or a transcript, attach a file, or
                  both.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="supportingText">Supporting Notes</Label>
                <Textarea
                  id="supportingText"
                  className="min-h-40"
                  placeholder="Paste call notes, a transcript, or other context…"
                  disabled={submitting}
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
                  Supporting File (PDF, DOC, DOCX, or TXT — max 2MB)
                </Label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="supportingFile"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      submitting && "pointer-events-none opacity-50",
                    )}
                  >
                    Choose File
                  </label>
                  <input
                    id="supportingFile"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                    disabled={submitting}
                    className="hidden"
                  />
                  <span className="truncate text-sm text-muted-foreground">
                    {file ? file.name : "No file chosen"}
                  </span>
                  {file && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={submitting}
                      onClick={() => setFile(null)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
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

      <Dialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <DialogContent>
          <DialogTitle>Generation in progress</DialogTitle>
          <DialogDescription className="mt-2">
            The proposal is still being generated. If you leave now, it will
            still be created, but you won&apos;t be taken to it automatically
            — you&apos;ll need to find it from the dashboard instead.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Stay on this page
                </Button>
              }
            />
            <Button type="button" variant="destructive" onClick={goBack}>
              Leave anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
