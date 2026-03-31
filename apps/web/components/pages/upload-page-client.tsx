"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera } from "lucide-react";
import { AppShellLoading } from "@/components/layout/app-shell-loading";
import { EmptyState } from "@/components/layout/empty-state";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCreateCase } from "@/hooks/use-case";
import { EYE_SIDE_LABELS, UPLOAD_QUALITY_REQUIREMENTS } from "@/lib/constants";
import type { EyeSide } from "@/lib/types";
import { cn } from "@/lib/utils";

const eyeSideOptions: EyeSide[] = ["OS", "OD", "OU"];
const apiEyeSideByUiSide = {
  OD: "right",
  OS: "left",
  OU: "both"
} as const;

export function UploadPageClient() {
  const router = useRouter();
  const { hydrated, token } = useAuthSession();
  const createCaseMutation = useCreateCase();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [patientReference, setPatientReference] = useState("");
  const [eyeSide, setEyeSide] = useState<EyeSide>("OD");
  const [clinicalNotes, setClinicalNotes] = useState("");

  if (!hydrated) {
    return <AppShellLoading />;
  }

  if (!token) {
    return (
      <EmptyState
        actionHref="/login"
        actionLabel="Return to login"
        description="Sign in to submit a privacy-safe fundus image and start live inference processing."
        title="Authentication required"
      />
    );
  }

  const sessionToken = token;
  const canSubmit = Boolean(selectedFile && patientReference.trim()) && !createCaseMutation.isPending;

  async function handleRunAnalysis() {
    if (!selectedFile || !patientReference.trim()) {
      return;
    }

    const formData = new FormData();
    formData.set("image", selectedFile);
    formData.set("patient_ref", patientReference.trim());
    formData.set("eye_side", apiEyeSideByUiSide[eyeSide]);
    if (clinicalNotes.trim()) {
      formData.set("notes", clinicalNotes.trim());
    }

    try {
      const createdCase = await createCaseMutation.mutateAsync({ formData, token: sessionToken });
      router.push(`/cases/${createdCase.case_id}`);
    } catch {}
  }

  return (
    <div className="space-y-8">
      <UploadDropzone
        onFileAccepted={(file) => {
          createCaseMutation.reset();
          setSelectedFile(file);
        }}
        uploadProgress={createCaseMutation.isPending ? 84 : null}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="patient-reference">
                  Patient reference number
                </label>
                <Input
                  id="patient-reference"
                  onChange={(event) => setPatientReference(event.target.value)}
                  placeholder="PT-9234"
                  value={patientReference}
                />
                <p className="text-xs leading-6 text-slate-500">Use a privacy-safe reference number, never the patient name.</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Eye side</p>
                <div className="flex flex-wrap gap-3">
                  {eyeSideOptions.map((option) => (
                    <button
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        eyeSide === option
                          ? "border-primary bg-primary text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                      key={option}
                      onClick={() => setEyeSide(option)}
                      type="button"
                    >
                      {EYE_SIDE_LABELS[option]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="clinical-notes">
                  Clinical notes
                </label>
                <Textarea
                  id="clinical-notes"
                  onChange={(event) => setClinicalNotes(event.target.value)}
                  placeholder="Optional technician or intake notes"
                  value={clinicalNotes}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button className="h-12 px-6 text-base" disabled={!canSubmit} onClick={() => void handleRunAnalysis()} size="lg" type="button">
                {createCaseMutation.isPending ? "Starting analysis..." : "Run Analysis"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-sm leading-6 text-slate-500">
                Analysis remains disabled until a valid image file and patient reference number have been provided.
              </p>
            </div>
            {createCaseMutation.isError ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {createCaseMutation.error.message}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-primary">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Image quality requirements</h2>
                <p className="text-sm text-slate-600">Clear guidance helps technicians submit usable captures on the first attempt.</p>
              </div>
            </div>
            <ul className="space-y-3">
              {UPLOAD_QUALITY_REQUIREMENTS.map((requirement) => (
                <li className="rounded-[20px] border border-slate-200 bg-white/80 px-4 py-3 text-sm leading-7 text-slate-700" key={requirement}>
                  {requirement}
                </li>
              ))}
            </ul>
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
              If image quality is borderline, continue only when the original fundus view remains clinically interpretable.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
