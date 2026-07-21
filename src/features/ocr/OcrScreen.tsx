// ─── OCR Capture Screen ────────────────────────────────────────────────────
// On-device OCR via Tesseract.js — no cloud, PII masked before any field
// leaves the engine.
//
// User picks a document type (QUOTATION / IDENTITY_PROOF / ADDRESS_PROOF /
// LAND_DOCUMENT / EDP_CERTIFICATE / OTHER) and either "Capture from camera"
// or "Pick from gallery". Both buttons call
//   extractFromDocument(source, docType)
// which (on native) uses @capacitor/camera, or (on web) prompts for an
// image file. The result is rendered as:
//   • Extracted fields table (key → value, PII already masked)
//   • Raw text preview (PII-masked via maskPii)
//
// "Map to Profile" calls mapOcrToProfile(result, docType) and renders the
// resulting Partial<ProjectProfile> as JSON (Wave 5 will wire this into the
// active project's profile via projectEngine.applyEdit + repo.updateProfile).
// ───────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

import {
  extractFromDocument,
  mapOcrToProfile,
  type OcrResult,
} from "@/engines/ocr-engine";
import type { AttachmentType } from "@/shared/types/project-profile";

type DocTypeOption = {
  value: AttachmentType;
  label: string;
  hint: string;
};

const DOC_TYPES: DocTypeOption[] = [
  { value: "QUOTATION", label: "Machinery quotation", hint: "Extracts line items → machinery.items" },
  { value: "IDENTITY_PROOF", label: "Identity proof (Aadhaar/PAN)", hint: "PII-masked; → applicant.aadhaarNo/panNo" },
  { value: "ADDRESS_PROOF", label: "Address proof", hint: "→ location.state/district" },
  { value: "LAND_DOCUMENT", label: "Land document", hint: "→ land.status / ownedLandValue" },
  { value: "EDP_CERTIFICATE", label: "EDP certificate", hint: "→ applicant.edpCompleted + certificate #" },
  { value: "OTHER", label: "Other document", hint: "Generic extraction (best effort)" },
];

export function OcrScreen() {
  const [docType, setDocType] = useState<AttachmentType>("QUOTATION");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapped, setMapped] = useState<string | null>(null);

  const capture = async (source: "camera" | "gallery") => {
    setBusy(true);
    setError(null);
    setResult(null);
    setMapped(null);
    try {
      const r = await extractFromDocument(source, docType);
      if (!r.success) {
        setError(
          "Capture failed or returned no readable text. Try a clearer photo or a different document."
        );
      }
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleMap = () => {
    if (!result?.success) return;
    try {
      const partial = mapOcrToProfile(result, docType);
      setMapped(JSON.stringify(partial, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const selected = DOC_TYPES.find((d) => d.value === docType);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">OCR capture</h2>
        <p className="text-sm text-muted-foreground">
          On-device OCR via Tesseract.js — all PII (Aadhaar / PAN / phone /
          email) is masked before any field leaves the engine.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Document type</CardTitle>
          <CardDescription>
            Pick the type of document you're about to capture. The OCR engine
            biases field extraction to the type's expected fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="ocr-doctype">Document type</Label>
            <Select
              value={docType}
              onValueChange={(v) => setDocType(v as AttachmentType)}
            >
              <SelectTrigger id="ocr-doctype" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-muted-foreground">{selected.hint}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={() => capture("camera")}
              disabled={busy}
              className="min-h-11"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              Capture from camera
            </Button>
            <Button
              variant="outline"
              onClick={() => capture("gallery")}
              disabled={busy}
              className="min-h-11"
            >
              <ImageIcon className="size-4" /> Pick from gallery
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>OCR failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && result.success && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    Extracted fields
                  </CardTitle>
                  <CardDescription>
                    {Object.keys(result.extractedFields).length} field
                    {Object.keys(result.extractedFields).length === 1 ? "" : "s"}{" "}
                    · OCR confidence{" "}
                    <Badge variant="secondary" className="ml-1 text-[10px]">
                      {(result.confidence * 100).toFixed(0)}%
                    </Badge>
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={handleMap}
                  className="min-h-9"
                >
                  <Sparkles className="size-3.5" /> Map to profile
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(result.extractedFields).length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No labelled fields were extracted — see the raw text below.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field path</TableHead>
                      <TableHead>Extracted value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(result.extractedFields).map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {k}
                        </TableCell>
                        <TableCell className="break-all text-xs">
                          {v}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-emerald-500" />
                Raw text (PII-masked)
              </CardTitle>
              <CardDescription>
                Full OCR buffer after PII masking. Safe to display / persist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
                {result.rawText || "(empty)"}
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      {mapped && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Mapped profile fragment
            </CardTitle>
            <CardDescription>
              Output of <code className="text-xs">mapOcrToProfile(result, docType)</code>{" "}
              — a Partial&lt;ProjectProfile&gt; with provenance. Wave 5 will
              merge this into the active project via{" "}
              <code className="text-xs">projectEngine.applyEdit</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
              {mapped}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
