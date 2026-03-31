import { EmptyState } from "@/components/layout/empty-state";

export default function CaseNotFoundPage() {
  return (
    <EmptyState
      actionHref="/history"
      actionLabel="Return to history"
      description="The requested case could not be found in the mock frontend dataset. Review the case history list to open an available result."
      title="Case not found"
    />
  );
}

