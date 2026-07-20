"use client";

import { useState, useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Check,
  Globe,
  Monitor,
  Sun,
  Moon,
  Zap,
  ExternalLink,
  Shield,
  Database,
  Code2,
  Sparkles,
  Server,
  Info,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Types ─────────────────────────────────────────────────────────────────
interface AiProvider {
  id: string;
  baseUrl: string;
  modelName: string;
  isActive: boolean;
  createdAt: string;
  apiKeyMasked: string;
}

interface ProviderFormData {
  baseUrl: string;
  modelName: string;
  apiKey: string;
  isActive: boolean;
}

const EMPTY_FORM: ProviderFormData = {
  baseUrl: "",
  modelName: "",
  apiKey: "",
  isActive: false,
};

// ─── Provider Form Sub-Dialog ──────────────────────────────────────────────
function ProviderFormDialog({
  open,
  onOpenChange,
  initial,
  existingActiveCount,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AiProvider;
  existingActiveCount: number;
  onSubmit: (data: ProviderFormData) => Promise<void>;
}) {
  const isEditing = !!initial;
  const [form, setForm] = useState<ProviderFormData>(EMPTY_FORM);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          baseUrl: initial.baseUrl,
          modelName: initial.modelName,
          apiKey: "", // never prefill the key
          isActive: initial.isActive,
        });
      } else {
        setForm({ ...EMPTY_FORM, isActive: existingActiveCount === 0 });
      }
      setShowKey(false);
      setSaving(false);
    }
  }, [open, initial, existingActiveCount]);

  const canSetActive =
    isEditing
      ? form.isActive
      : form.isActive && existingActiveCount === 0;

  const handleSubmit = async () => {
    if (!form.baseUrl.trim() || !form.modelName.trim() || (!isEditing && !form.apiKey.trim())) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch {
      // toast already shown by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-500" />
            {isEditing ? "Edit Provider" : "Add Provider"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the AI provider configuration."
              : "Configure a new AI provider for project assistance."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="provider-url">Base URL</Label>
            <Input
              id="provider-url"
              placeholder="https://api.openai.com/v1"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
            />
          </div>

          {/* Model Name */}
          <div className="space-y-2">
            <Label htmlFor="provider-model">Model Name</Label>
            <Input
              id="provider-model"
              placeholder="gpt-4o-mini"
              value={form.modelName}
              onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="provider-key">
              API Key {isEditing && <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>}
            </Label>
            <div className="relative">
              <Input
                id="provider-key"
                type={showKey ? "text" : "password"}
                placeholder={isEditing ? "••••••••" : "sk-..."}
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey(!showKey)}
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="provider-active" className="text-sm">
                Set as Active
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {isEditing
                  ? "Deactivate all other providers and use this one."
                  : existingActiveCount > 0
                    ? "Deactivate the current active provider first."
                    : "This will be the default AI provider."}
              </p>
            </div>
            <Switch
              id="provider-active"
              checked={canSetActive}
              disabled={isEditing ? false : existingActiveCount > 0}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? "Update" : "Add Provider"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── AI Configuration Tab ──────────────────────────────────────────────────
function AiConfigTab() {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AiProvider | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AiProvider | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-provider");
      const json = await res.json();
      if (json.success) {
        setProviders(json.data);
      } else {
        toast.error(json.error?.message || "Failed to load providers");
      }
    } catch {
      toast.error("Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const activeCount = providers.filter((p) => p.isActive).length;

  const handleCreate = async (data: ProviderFormData) => {
    const res = await fetch("/api/ai-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Provider added successfully");
      fetchProviders();
    } else {
      toast.error(json.error?.message || "Failed to add provider");
      throw new Error("Failed");
    }
  };

  const handleEdit = async (data: ProviderFormData) => {
    if (!editingProvider) return;
    const res = await fetch("/api/ai-provider", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingProvider.id, ...data }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Provider updated successfully");
      fetchProviders();
    } else {
      toast.error(json.error?.message || "Failed to update provider");
      throw new Error("Failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/ai-provider/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Provider deleted");
        setProviders((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      } else {
        toast.error(json.error?.message || "Failed to delete provider");
      }
    } catch {
      toast.error("Failed to delete provider");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (provider: AiProvider) => {
    const newActive = !provider.isActive;
    setTogglingId(provider.id);
    try {
      const res = await fetch("/api/ai-provider", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: provider.id, isActive: newActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          newActive ? `${provider.modelName} set as active` : `${provider.modelName} deactivated`
        );
        fetchProviders();
      } else {
        toast.error(json.error?.message || "Failed to toggle provider");
      }
    } catch {
      toast.error("Failed to toggle provider");
    } finally {
      setTogglingId(null);
    }
  };

  const openEdit = (provider: AiProvider) => {
    setEditingProvider(provider);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditingProvider(undefined);
    setFormOpen(true);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const truncateUrl = (url: string, max = 40) => {
    if (url.length <= max) return url;
    return url.slice(0, max) + "…";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configure AI providers to power project assistance features.
        </p>
        <Button
          size="sm"
          onClick={openCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Provider
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-muted/50 animate-pulse"
            />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-medium">No AI providers configured</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Add an AI provider to enable intelligent project assistance features
            like eligibility checks and financial projections.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={openCreate}
            className="mt-4 h-8 gap-1.5 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Your First Provider
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
          <AnimatePresence mode="popLayout">
            {providers.map((provider) => (
              <motion.div
                key={provider.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-border/60 hover:border-emerald-300/60 dark:hover:border-emerald-700/60 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">
                            {provider.modelName}
                          </span>
                          {provider.isActive ? (
                            <Badge
                              variant="default"
                              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-[10px] px-2 py-0 h-5"
                            >
                              <Check className="w-3 h-3 mr-0.5" />
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-2 py-0 h-5"
                            >
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {truncateUrl(provider.baseUrl)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Key: {provider.apiKeyMasked} · Added {formatDate(provider.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                          onClick={() => handleToggleActive(provider)}
                          disabled={togglingId === provider.id}
                          title={provider.isActive ? "Deactivate" : "Set Active"}
                        >
                          {togglingId === provider.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : provider.isActive ? (
                            <Shield className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(provider)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                          onClick={() => setDeleteTarget(provider)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Provider Form Sub-Dialog */}
      <ProviderFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingProvider(undefined);
        }}
        initial={editingProvider}
        existingActiveCount={activeCount}
        onSubmit={editingProvider ? handleEdit : handleCreate}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteTarget?.modelName}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Preferences Tab ───────────────────────────────────────────────────────
function PreferencesTab() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // next-themes returns undefined for resolvedTheme on the server / before hydration
  const mounted = resolvedTheme !== undefined;

  const themeOptions = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Theme Preference */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Theme</Label>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => {
            const isSelected = mounted && theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`
                  relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200
                  ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm"
                      : "border-border/60 hover:border-emerald-300/60 dark:hover:border-emerald-700/60"
                  }
                `}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isSelected
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-xs font-medium ${
                    isSelected
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {isSelected && (
                  <motion.div
                    layoutId="theme-indicator"
                    className="absolute top-2 right-2"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </motion.div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Language (read-only) */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Language</Label>
        <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">English</span>
          <Badge variant="secondary" className="text-[10px] ml-auto">
            Default
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Version */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Version</Label>
        <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
          <Code2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">PMEGP Assistant v0.2.0</span>
        </div>
      </div>
    </div>
  );
}

// ─── About Tab ─────────────────────────────────────────────────────────────
function AboutTab() {
  const techStack = [
    { name: "Next.js 16", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    { name: "TypeScript", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    { name: "Tailwind CSS 4", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
    { name: "Prisma", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
    { name: "shadcn/ui", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    { name: "Framer Motion", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  ];

  return (
    <div className="space-y-6">
      {/* App Info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2 py-2"
      >
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25">
          <Settings className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold">PMEGP Assistant</h3>
          <p className="text-sm text-muted-foreground">v0.2.0</p>
        </div>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          AI-assisted PMEGP subsidy application builder — micro-enterprise project
          discovery, eligibility checks, financial projections, and DPR generation.
        </p>
      </motion.div>

      <Separator />

      {/* Tech Stack */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Built With</Label>
        <div className="flex flex-wrap gap-2 justify-center">
          {techStack.map((tech) => (
            <Badge
              key={tech.name}
              variant="secondary"
              className={`${tech.color} text-[11px] px-2.5 py-1 border-0 font-medium`}
            >
              {tech.name}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Links */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Official Resources</Label>
        <div className="space-y-2">
          <a
            href="https://www.kvic.org.in/pmegp.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">KVIC PMEGP Portal</p>
              <p className="text-[11px] text-muted-foreground truncate">
                kvic.org.in/pmegp.htm
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 transition-colors shrink-0" />
          </a>
          <a
            href="https://msme.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">MoMSME</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Ministry of Micro, Small & Medium Enterprises
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 transition-colors shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Dialog ──────────────────────────────────────────────────
export function SettingsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Open settings"
      >
        <Settings className="w-4.5 h-4.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4.5 h-4.5 text-emerald-600" />
              Settings
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage AI providers, preferences, and app configuration.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="ai" className="px-6 pb-6 pt-4">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="ai" className="text-xs gap-1.5 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                AI Config
              </TabsTrigger>
              <TabsTrigger value="preferences" className="text-xs gap-1.5 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400">
                <Monitor className="w-3.5 h-3.5" />
                Preferences
              </TabsTrigger>
              <TabsTrigger value="about" className="text-xs gap-1.5 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400">
                <Info className="w-3.5 h-3.5" />
                About
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              <motion.div
                key="ai"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
              >
                <TabsContent value="ai" className="mt-0">
                  <AiConfigTab />
                </TabsContent>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key="preferences"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
              >
                <TabsContent value="preferences" className="mt-0">
                  <PreferencesTab />
                </TabsContent>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key="about"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
              >
                <TabsContent value="about" className="mt-0">
                  <AboutTab />
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}