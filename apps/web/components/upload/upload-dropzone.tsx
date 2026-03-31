"use client";

import Image from "next/image";
import { startTransition, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileImage, FileUp, FolderOpen, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createDicomPlaceholderDataUri } from "@/lib/mock-assets";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  maxSizeMb?: number;
  uploadProgress?: number | null;
  onFileAccepted?: (file: File) => void;
  initialPreview?: {
    name: string;
    previewSrc: string;
    isDicom?: boolean;
    sizeLabel: string;
  };
  className?: string;
}

interface SelectedFileState {
  file?: File;
  name: string;
  previewSrc: string;
  sizeLabel: string;
  isDicom: boolean;
}

const acceptedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "application/dicom"];
const acceptedExtensions = [".jpg", ".jpeg", ".png", ".dcm", ".dicom"];
const dicomPlaceholderDataUri = createDicomPlaceholderDataUri();

function isDicomFile(file: File) {
  const lowered = file.name.toLowerCase();
  return file.type === "application/dicom" || lowered.endsWith(".dcm") || lowered.endsWith(".dicom");
}

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function UploadDropzone({
  maxSizeMb = 20,
  uploadProgress = 68,
  onFileAccepted,
  initialPreview,
  className
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFileState | null>(() =>
    initialPreview
      ? {
          name: initialPreview.name,
          previewSrc: initialPreview.previewSrc,
          sizeLabel: initialPreview.sizeLabel,
          isDicom: initialPreview.isDicom ?? false
        }
      : null
  );

  useEffect(() => {
    return () => {
      if (selectedFile?.file && !selectedFile.isDicom) {
        URL.revokeObjectURL(selectedFile.previewSrc);
      }
    };
  }, [selectedFile]);

  function handleFiles(files: FileList | null) {
    const nextFile = files?.[0];

    if (!nextFile) {
      return;
    }

    const lowerName = nextFile.name.toLowerCase();
    const fileTypeAccepted =
      acceptedMimeTypes.includes(nextFile.type) || acceptedExtensions.some((ext) => lowerName.endsWith(ext));

    if (!fileTypeAccepted) {
      setErrorMessage("Only JPG, PNG, and DICOM files are supported.");
      return;
    }

    if (nextFile.size > maxSizeMb * 1024 * 1024) {
      setErrorMessage(`File exceeds the ${maxSizeMb} MB limit. Please upload a smaller study.`);
      return;
    }

    const dicom = isDicomFile(nextFile);
    const previewSrc = dicom ? dicomPlaceholderDataUri : URL.createObjectURL(nextFile);

    startTransition(() => {
      setErrorMessage(null);
      setSelectedFile({
        file: nextFile,
        name: nextFile.name,
        previewSrc,
        sizeLabel: formatFileSize(nextFile.size),
        isDicom: dicom
      });
      onFileAccepted?.(nextFile);
    });
  }

  return (
    <Card className={cn("glass-panel border border-white/50", className)}>
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <FileUp className="h-3.5 w-3.5" />
          Case upload
        </div>
        <CardTitle className="text-2xl text-slate-950">Upload a full-quality retinal image for AI-assisted review</CardTitle>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Support for JPG, PNG, and DICOM. Validation happens immediately so technicians know whether an image is ready for processing.
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr,0.95fr]">
        <motion.div
          animate={{ scale: dragActive ? 1.01 : 1, y: dragActive ? -2 : 0 }}
          className={cn(
            "relative rounded-[28px] border-2 border-dashed p-6 transition",
            dragActive ? "border-primary bg-sky-50 shadow-[0_20px_60px_rgba(14,165,233,0.16)]" : "border-slate-300 bg-slate-50/70"
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            handleFiles(event.dataTransfer.files);
          }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <input
            ref={inputRef}
            accept=".jpg,.jpeg,.png,.dcm,.dicom,image/jpeg,image/png,application/dicom"
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
            type="file"
          />
          <div className="flex h-full flex-col items-start justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <ScanLine className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-950">Drag and drop, or choose a file</h3>
                <p className="max-w-lg text-sm leading-6 text-slate-600">
                  Images remain linked to the case UUID, not patient-identifying filenames. DICOM uploads display as a neutral file tile until preview conversion is available.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => inputRef.current?.click()} type="button">
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse files
              </Button>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                JPG, PNG, DICOM | up to {maxSizeMb} MB
              </div>
            </div>
            {errorMessage ? (
              <div
                aria-live="polite"
                className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {errorMessage}
              </div>
            ) : null}
          </div>
        </motion.div>

        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Selected file</p>
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div
                key={selectedFile.name}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 space-y-4"
                exit={{ opacity: 0, y: 8 }}
                initial={{ opacity: 0, y: 8 }}
              >
                <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100">
                  {selectedFile.isDicom ? (
                    <Image
                      alt="DICOM file placeholder"
                      className="aspect-square w-full object-cover"
                      height={512}
                      src={selectedFile.previewSrc}
                      unoptimized
                      width={512}
                    />
                  ) : (
                    <Image
                      alt={selectedFile.name}
                      className="aspect-square w-full object-cover"
                      height={512}
                      src={selectedFile.previewSrc}
                      unoptimized
                      width={512}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileImage className="h-4 w-4 text-primary" />
                    {selectedFile.name}
                  </div>
                  <p className="text-sm text-slate-600">
                    {selectedFile.isDicom ? "DICOM file" : "Image preview"} | {selectedFile.sizeLabel}
                  </p>
                </div>
                {typeof uploadProgress === "number" ? (
                  <div className="space-y-3 rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">Upload progress</span>
                      <span className="font-semibold text-slate-950">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                key="empty-state"
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex min-h-[24rem] flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-slate-50/70 p-6 text-center"
                exit={{ opacity: 0, y: 8 }}
                initial={{ opacity: 0, y: 8 }}
              >
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white">
                  <FileUp className="h-7 w-7" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-950">No file selected yet</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
                  Once a file is chosen, clinicians can confirm format, preview the study, and monitor upload progress without leaving the case screen.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
