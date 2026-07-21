// ─── Settings Screen ───────────────────────────────────────────────────────
// AI provider config + Knowledge Package version + Import/Export project.
//
// Wave 4 scope:
//   • Provider config form (baseUrl / apiKey / modelName) — apiKey is
//     type="password". Values are loaded from / saved to localStorage
//     (placeholder). Wave 5 will move base URL + model to SQLite
//     (ai_provider_config) and the API key to Secure Storage (Android
//     Keystore).
//   • "Test Connection" button calls
//       getAIResponse([{role:"system", content:"ping"},
//                      {role:"user",   content:"respond with OK"}],
//                     {baseUrl, apiKey, modelName})
//     and shows success / failure (with the error message).
//   • Knowledge version display: getCurrentKnowledgeVersion() (sync; the
//     engine kicks off a background DB read on first call and returns
//     "bundled" in the meantime — we re-render on a 1s timer for ~3s to
//     pick up the cached value).
//   • "Export Project" — opens a dialog to pick a project from the
//     repository, then calls exportProject(profile, financials, eligibility)
//     and triggers a JSON download.
//   • "Import Project" — file input that reads a JSON envelope and calls
//     importProject(json). On success, shows a summary of the imported
//     project; on failure, shows the schema error message. Wave 5 will
//     persist the imported project via repo.create + repo.updateProfile.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Plug,
  Save,
  Download,
  Upload,
  Database,
  ShieldCheck,
} from "lucide-react";

import { getAIResponse, type ProviderConnectionConfig } from "@/providers";
import { getCurrentKnowledgeVersion } from "@/engines/update-engine";
import { exportProject, importProject } from "@/engines/import-export-engine";
import { getProjectRepository } from "@/database/project-repository";
import { computeFinancials } from "@/engines/financial-engine";
import { checkEligibility } from "@/engines/eligibility-engine";
import type { ProjectSummary } from "@/database/interfaces";
import { formatDateTime } from "@/shared/format";
// Wave 6: biometric unlock settings panel.
import { BiometricSettings } from "@/features/biometric";

// ── localStorage persistence (Wave 5 will replace with SQLite + Secure Storage) ──

const LS_BASE_URL = "pmegp.aiProvider.baseUrl";
const LS_MODEL_NAME = "pmegp.aiProvider.modelName";
const LS_API_KEY = "pmegp.aiProvider.apiKey"; // Wave 5: move to Secure Storage

function loadString(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function saveString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota / disabled storage
  }
}

type TestState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; reply: string }
  | { kind: "fail"; error: string };

export function SettingsScreen() {
  // Provider config form state
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [test, setTest] = useState<TestState>({ kind: "idle" });
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Knowledge version
  const [knowledgeVersion, setKnowledgeVersion] = useState("bundled");

  // Export / import state
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [exportId, setExportId] = useState<string>("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedSummary, setImportedSummary] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    setBaseUrl(loadString(LS_BASE_URL));
    setApiKey(loadString(LS_API_KEY));
    setModelName(loadString(LS_MODEL_NAME));
    setKnowledgeVersion(getCurrentKnowledgeVersion());

    // Refresh knowledge version after the engine's background DB read settles.
    const t1 = setTimeout(() => setKnowledgeVersion(getCurrentKnowledgeVersion()), 800);
    const t2 = setTimeout(() => setKnowledgeVersion(getCurrentKnowledgeVersion()), 2000);
    const t3 = setTimeout(() => setKnowledgeVersion(getCurrentKnowledgeVersion()), 4000);

    // Load projects for the export selector.
    (async () => {
      try {
        const list = await getProjectRepository().list();
        setProjects(list);
        if (list.length > 0 && !exportId) setExportId(list[0].id);
      } catch {
        // ignore — empty list shown
      }
    })();

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conn: ProviderConnectionConfig = useMemo(
    () => ({ baseUrl, apiKey, modelName }),
    [baseUrl, apiKey, modelName],
  );

  const canTest = baseUrl.trim() !== "" && apiKey.trim() !== "" && modelName.trim() !== "";

  const handleTest = async () => {
    if (!canTest) return;
    setTest({ kind: "running" });
    try {
      const resp = await getAIResponse(
        [
          { role: "system", content: "ping" },
          { role: "user", content: "respond with OK" },
        ],
        conn,
      );
      if (resp.success && resp.content) {
        setTest({ kind: "ok", reply: resp.content });
      } else {
        setTest({ kind: "fail", error: resp.error ?? "Unknown provider error" });
      }
    } catch (err) {
      setTest({
        kind: "fail",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleSave = () => {
    saveString(LS_BASE_URL, baseUrl.trim());
    saveString(LS_MODEL_NAME, modelName.trim());
    saveString(LS_API_KEY, apiKey.trim()); // Wave 5: Secure Storage
    setSavedAt(new Date().toISOString());
  };

  const handleExport = async () => {
    if (!exportId) return;
    setExportBusy(true);
    setExportError(null);
    try {
      const repo = getProjectRepository();
      const row = await repo.getById(exportId);
      if (!row) {
        setExportError("Project not found.");
        return;
      }
      const financials = computeFinancials(row.profile);
      const eligibility = checkEligibility(row.profile);
      const envelope = await exportProject(row.profile, financials, eligibility);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pmegp-project-${row.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setImportError(null);
    setImportedSummary(null);
    try {
      const text = await file.text();
      const result = importProject(text);
      if ("error" in result) {
        setImportError(result.error);
        return;
      }
      const businessName = (result.profile as { business?: { name?: string } }).business?.name ?? "(no name)";
      const totalCost = (result.profile as { financials?: { totalProjectCost?: number } }).financials?.totalProjectCost ?? 0;
      const eligible = result.eligibility.eligible;
      setImportedSummary(
        `Parsed envelope: project "${businessName}", total cost ₹${totalCost.toLocaleString("en-IN")}, eligible=${eligible}. ` +
          `Wave 5 will persist this via the repository.`,
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          AI provider, Knowledge Package version, and project import / export.
        </p>
      </div>

      {/* AI Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="size-4" /> AI provider
          </CardTitle>
          <CardDescription>
            OpenAI-compatible endpoint. The app calls this directly via{" "}
            <code className="text-xs">fetch</code> — there is no built-in
            provider. Wave 5 moves base URL + model to SQLite and the API key
            to Secure Storage (Android Keystore).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-base-url">Base URL</Label>
            <Input
              id="ai-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="min-h-11"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-api-key">API key</Label>
            <Input
              id="ai-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              className="min-h-11"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Stored only in this browser's localStorage for Wave 4. Never
              logged, never sent anywhere except your configured base URL.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-model">Model name</Label>
            <Input
              id="ai-model"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="gpt-4o · claude-3-5-sonnet · llama-3.1-70b"
              className="min-h-11"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={handleTest}
              disabled={!canTest || test.kind === "running"}
              variant="outline"
              className="min-h-11"
            >
              {test.kind === "running" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plug className="size-4" />
              )}
              Test connection
            </Button>
            <Button onClick={handleSave} disabled={false} className="min-h-11">
              <Save className="size-4" /> Save
            </Button>
          </div>

          {test.kind === "ok" && (
            <Alert>
              <CheckCircle2 className="size-4 text-emerald-500" />
              <AlertTitle>Connection OK</AlertTitle>
              <AlertDescription>
                Provider replied:{" "}
                <span className="font-mono text-xs">{test.reply}</span>
              </AlertDescription>
            </Alert>
          )}
          {test.kind === "fail" && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>Connection failed</AlertTitle>
              <AlertDescription>{test.error}</AlertDescription>
            </Alert>
          )}
          {savedAt && (
            <p className="text-xs text-muted-foreground">
              Saved at {formatDateTime(savedAt)}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Biometric unlock (Wave 6) */}
      <BiometricSettings />

      {/* Knowledge version */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" /> Knowledge Package
          </CardTitle>
          <CardDescription>
            Bundled PMEGP reference data. Updates are downloaded from a CDN
            and verified with Ed25519 signatures (see Update Engine).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">
              Current version
            </Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {knowledgeVersion}
              </Badge>
              <ShieldCheck className="size-4 text-emerald-500" />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto min-h-9"
            onClick={() => setKnowledgeVersion(getCurrentKnowledgeVersion())}
          >
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4" /> Export project
          </CardTitle>
          <CardDescription>
            Build a portable JSON envelope (profile + computed financials +
            eligibility snapshot + knowledge version) and download it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No projects in the repository yet.
            </p>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="export-id">Project</Label>
                <Select value={exportId} onValueChange={setExportId}>
                  <SelectTrigger id="export-id" className="min-h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.businessName || p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleExport}
                disabled={!exportId || exportBusy}
                className="min-h-11"
              >
                {exportBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Download JSON
              </Button>
            </>
          )}
          {exportError && (
            <Alert variant="destructive">
              <AlertTitle>Export failed</AlertTitle>
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4" /> Import project
          </CardTitle>
          <CardDescription>
            Read an exported JSON envelope and validate it. Wave 4 only parses
            and reports — Wave 5 will persist via the repository.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportFile(f);
              // Reset value so picking the same file twice still fires.
              e.target.value = "";
            }}
            className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground hover:file:bg-primary/90"
          />
          {importError && (
            <Alert variant="destructive">
              <AlertTitle>Import failed</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}
          {importedSummary && (
            <Alert>
              <CheckCircle2 className="size-4 text-emerald-500" />
              <AlertTitle>Import parsed</AlertTitle>
              <AlertDescription>{importedSummary}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
