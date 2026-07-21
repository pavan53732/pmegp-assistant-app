// ─── Client-Side Pipeline API ────────────────────────────────────────────
// Thin wrapper over the pipeline API endpoints.
// UI components call these functions; they never import engines directly.
// ───────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────

/** Shape of the data returned from a pipeline step execution. */
export interface PipelineStepResponse {
  success: boolean;
  status: string;
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

/** A single step's display info for the UI stepper. */
export interface PipelineStepInfo {
  step: string;
  label: string;
  description: string;
}

/** Ordered pipeline steps with display metadata. */
export const PIPELINE_STEPS_INFO: PipelineStepInfo[] = [
  {
    step: "eligibility",
    label: "Eligibility Check",
    description: "Verify PMEGP scheme eligibility based on category, age, and project parameters",
  },
  {
    step: "financial",
    label: "Financial Analysis",
    description: "Compute financial projections, subsidy, DSCR, and repayment schedule",
  },
  {
    step: "dpr",
    label: "DPR Generation",
    description: "Generate Detailed Project Report with all sections and tables",
  },
  {
    step: "pdf",
    label: "PDF Export",
    description: "Create printable document from the Detailed Project Report",
  },
];

// ── API Function ──────────────────────────────────────────────────────────

/**
 * Execute a single pipeline step for a project.
 *
 * Calls `POST /api/projects/[id]/pipeline?step=<step>` and returns
 * the structured result.
 *
 * @param projectId - The project's unique identifier.
 * @param step      - The pipeline step to execute (eligibility | financial | dpr | pdf).
 * @returns The pipeline step result including success, new status, data, errors, and warnings.
 * @throws Error on network failure or non-success API response.
 */
export async function runPipelineStep(
  projectId: string,
  step: string
): Promise<PipelineStepResponse> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/pipeline?step=${encodeURIComponent(step)}`,
    { method: "POST" }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? ((body as { error: { message: string } }).error?.message ??
          `HTTP ${res.status}`)
        : `HTTP ${res.status}`;
    throw new Error(message);
  }

  const body = (await res.json()) as {
    success: boolean;
    data: PipelineStepResponse;
  };

  if (!body.success || !body.data) {
    throw new Error("Pipeline request returned unexpected response format");
  }

  return body.data;
}

/**
 * Download the generated PDF for a project.
 * Fetches the project data and triggers a browser download of the PDF text file.
 *
 * @param projectId - The project's unique identifier.
 * @param fileName  - Optional custom filename (defaults to "dpr-report.txt").
 */
export async function downloadPdf(
  projectId: string,
  fileName = "dpr-report.txt"
): Promise<void> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch project data for download");
  }

  const body = (await res.json()) as {
    success: boolean;
    data: { profile: { pipelineOutputs?: { pdfBase64?: string } } };
  };

  const base64 = body.data?.profile?.pipelineOutputs?.pdfBase64;
  if (!base64) {
    throw new Error("PDF data not found. Generate the PDF first.");
  }

  // Decode base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Trigger download
  const blob = new Blob([bytes], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Download the DPR as a JSON file.
 * Fetches the project data and triggers a browser download of the DPR JSON.
 *
 * @param projectId - The project's unique identifier.
 * @param fileName  - Optional custom filename (defaults to "dpr-document.json").
 */
export async function downloadDpr(
  projectId: string,
  fileName = "dpr-document.json"
): Promise<void> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch project data for download");
  }

  const body = (await res.json()) as {
    success: boolean;
    data: { profile: { pipelineOutputs?: { dprDocument?: unknown } } };
  };

  const dpr = body.data?.profile?.pipelineOutputs?.dprDocument;
  if (!dpr) {
    throw new Error("DPR data not found. Generate the DPR first.");
  }

  const blob = new Blob([JSON.stringify(dpr, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}