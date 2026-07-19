"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertCircle, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { PhaseIndicator } from "./phase-indicator";
import { ChatMessageBubble } from "./chat-message";
import { ChatInput } from "./chat-input";
import { sendChatMessage, formatIndianCurrency } from "@/lib/interview-api";
import type { ChatMessage, InterviewState } from "@/features/ai/interview/types";
import type { ProjectProfile } from "@/shared/types/project-profile";
import type { InterviewPhase, PhaseProgress } from "@/shared/types/interview";

// ── Props ──────────────────────────────────────────────────────────────────

interface ChatViewProps {
  projectId: string;
  initialProfile?: ProjectProfile;
  onGoBack: () => void;
  onEnterReview: (profile: ProjectProfile) => void;
}

// ── Thinking indicator ─────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4" />
      </div>
      <div className="flex items-center gap-1.5 bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
        <span className="text-xs">Thinking…</span>
      </div>
    </motion.div>
  );
}

// ── Profile summary for side panel ─────────────────────────────────────────

function ProfileSummary({ profile }: { profile: ProjectProfile | null }) {
  const rows = useMemo(() => {
    if (!profile) return [] as { label: string; value: string }[];
    const r: { label: string; value: string }[] = [];
    if (profile.applicant?.name) r.push({ label: "Name", value: profile.applicant.name });
    if (profile.applicant?.category) r.push({ label: "Category", value: profile.applicant.category });
    if (profile.business?.description) r.push({ label: "Business", value: profile.business.description.slice(0, 60) });
    if (profile.business?.nicCode) r.push({ label: "NIC Code", value: `${profile.business.nicCode} — ${profile.business.nicDescription ?? ""}` });
    if (profile.location?.state) r.push({ label: "Location", value: `${profile.location.district}, ${profile.location.state}` });
    if (profile.financials?.totalProjectCost)
      r.push({ label: "Project Cost", value: formatIndianCurrency(profile.financials.totalProjectCost) });
    return r;
  }, [profile]);

  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No details collected yet.</p>;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between text-xs gap-2">
          <span className="text-muted-foreground shrink-0">{r.label}</span>
          <span className="font-medium text-right truncate">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Default phase progress ─────────────────────────────────────────────────

function makeDefaultPhaseProgress(): Record<InterviewPhase, PhaseProgress> {
  return {
    APPLICANT_DISCOVERY: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    BUSINESS_DISCOVERY: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    ACTIVITY_RESOLUTION: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    PROJECT_SIZING: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    FINANCIAL_PLANNING: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    REVIEW: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    VALIDATION_COMPLETION: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
  };
}

// ── Main Chat View ─────────────────────────────────────────────────────────

export function ChatView({
  projectId,
  initialProfile,
  onGoBack,
  onEnterReview,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState | null>(null);
  const [profile, setProfile] = useState<ProjectProfile | null>(initialProfile ?? null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Send a message and handle the response
  const handleSend = useCallback(
    async (text: string) => {
      setError(null);
      setLoading(true);

      // Add user message optimistically
      const userMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        role: "USER",
        content: text,
        timestamp: new Date().toISOString(),
        phase: interviewState?.currentPhase ?? "APPLICANT_DISCOVERY",
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const res = await sendChatMessage(projectId, text);

        if (res.message) {
          setMessages((prev) => [...prev, res.message!]);
        }
        if (res.profile) {
          setProfile(res.profile);
        }
        if (res.state) {
          setInterviewState(res.state);

          // If we've reached the REVIEW phase, notify parent with the latest profile
          if (res.state.currentPhase === "REVIEW" && !res.state.isComplete && res.profile) {
            onEnterReview(res.profile);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setError(msg);
        toast.error("Error", { description: msg });
      } finally {
        setLoading(false);
      }
    },
    [projectId, interviewState, onEnterReview]
  );

  // Handle suggestion chip click
  const handleSuggestionClick = useCallback(
    (value: string) => {
      handleSend(value);
    },
    [handleSend]
  );

  // Derive phase data
  const currentPhase: InterviewPhase = interviewState?.currentPhase ?? profile?.completion?.currentPhase ?? "APPLICANT_DISCOVERY";
  const phaseProgress = profile?.completion?.phaseProgress ?? makeDefaultPhaseProgress();
  const completeness = profile?.validation?.completeness ?? 0;

  return (
    <div className="flex flex-col h-[calc(100vh-1px)] sm:h-screen bg-background">
      {/* ── Chat Header ─────────────────────────────────────────── */}
      <header className="border-b bg-card shrink-0">
        <div className="max-w-4xl mx-auto px-3 py-3 sm:px-4 sm:py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onGoBack}
            aria-label="Back to dashboard"
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold truncate">
                {profile?.business?.name || profile?.business?.description || "New Project"}
              </h1>
            </div>
            <PhaseIndicator
              currentPhase={currentPhase}
              phaseProgress={phaseProgress}
              completeness={completeness}
            />
          </div>

          {/* Desktop: profile summary side sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex shrink-0 text-xs"
              >
                Summary
              </Button>
            </SheetTrigger>
            <SheetContent className="w-72">
              <SheetTitle className="text-sm font-semibold mb-4">
                Project Summary
              </SheetTitle>
              <Separator className="mb-4" />
              <ProfileSummary profile={profile} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ── Messages Area ───────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                <Bot className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold mb-1">
                PMEGP Interview
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                I&apos;ll help you build your PMEGP application step by step.
                Start by telling me a bit about yourself.
              </p>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                onSuggestionClick={handleSuggestionClick}
              />
            ))}
          </AnimatePresence>

          {loading && <ThinkingIndicator />}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Retry: remove last user message and clear error
                  setMessages((prev) => prev.slice(0, -1));
                  setError(null);
                }}
                className="text-xs h-7"
              >
                Retry
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input Area (sticky bottom) ──────────────────────────── */}
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}