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
import {
  ArrowLeft,
  AlertCircle,
  Bot,
  Sparkles,
  MessageSquareText,
  Store,
  UtensilsCrossed,
  RefreshCw,
  RotateCcw,
  Bot as BotIcon,
  ShieldCheck,
  Calculator,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { notificationCenter } from "@/components/notification-center";
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
import {
  streamChatMessage,
  fetchChatHistory,
  sendChatMessage,
  formatIndianCurrency,
} from "@/lib/interview-api";
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

// ── Example prompts for welcome screen ─────────────────────────────────────

const EXAMPLE_PROMPTS = [
  {
    text: "I want to start a papad making unit",
    icon: UtensilsCrossed,
  },
  {
    text: "Help me apply for PMEGP for a tailoring shop",
    icon: Store,
  },
  {
    text: "I plan to open a small bakery",
    icon: Sparkles,
  },
  {
    text: "I want to set up a small agarbatti manufacturing unit",
    icon: MessageSquareText,
  },
];

// ── Feature cards for welcome screen ───────────────────────────────────────

const FEATURES = [
  {
    icon: BotIcon,
    title: "AI-Guided Interview",
    description: "Step-by-step questions to build your application",
  },
  {
    icon: ShieldCheck,
    title: "Auto Validation",
    description: "Real-time checks for PMEGP eligibility",
  },
  {
    icon: Calculator,
    title: "Financial Projections",
    description: "Automated cost and revenue calculations",
  },
  {
    icon: FileText,
    title: "DPR Generation",
    description: "Generate a complete Detailed Project Report",
  },
];

// ── Floating particles for welcome screen ──────────────────────────────────

function FloatingParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 5,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-emerald-400/20 dark:bg-emerald-500/15"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ── Shimmer border wrapper ─────────────────────────────────────────────────

function ShimmerBorder({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl ${className ?? ""}`}>
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-300/40 via-teal-200/60 to-emerald-300/40 dark:from-emerald-600/30 dark:via-teal-500/40 dark:to-emerald-600/30 animate-shimmer" />
      <div className="relative">{children}</div>
    </div>
  );
}

// ── Thinking indicator ─────────────────────────────────────────────────────

const THINKING_LABELS: Record<string, string> = {
  APPLICANT_DISCOVERY: "Analyzing your personal details…",
  BUSINESS_DISCOVERY: "Understanding your business idea…",
  ACTIVITY_RESOLUTION: "Resolving activity classification…",
  PROJECT_SIZING: "Calculating project requirements…",
  FINANCIAL_PLANNING: "Building financial projections…",
  REVIEW: "Preparing your review summary…",
  VALIDATION_COMPLETION: "Validating your application…",
};

function ThinkingIndicator({ currentPhase }: { currentPhase: InterviewPhase }) {
  const label = THINKING_LABELS[currentPhase] ?? "Thinking…";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-2.5 text-sm text-muted-foreground"
    >
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
        <div className="relative w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center">
          <Bot className="w-4 h-4" />
        </div>
      </div>

      {/* Thinking bubble with gradient animation */}
      <motion.div
        className="flex items-center gap-2 bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm relative overflow-hidden"
        animate={{
          borderColor: [
            "hsl(var(--border))",
            "rgba(16,185,129,0.3)",
            "hsl(var(--border))",
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Subtle gradient shimmer inside bubble */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-emerald-50/0 via-emerald-50/30 to-emerald-50/0 dark:from-emerald-900/0 dark:via-emerald-900/20 dark:to-emerald-900/0 pointer-events-none"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />

        {/* Animated dots */}
        <div className="flex items-center gap-1 relative">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              animate={{
                opacity: [0.3, 1, 0.3],
                y: [0, -3, 0],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        <span className="text-xs relative">{label}</span>
      </motion.div>
    </motion.div>
  );
}

// ── Welcome screen ────────────────────────────────────────────────────────

function WelcomeScreen({ onSend }: { onSend: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4"
    >
      {/* Floating particles */}
      <FloatingParticles />

      {/* Gradient card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="relative w-full max-w-md mb-8"
      >
        {/* Decorative blurred circles */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-emerald-300/30 dark:bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-teal-300/20 dark:bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative rounded-2xl p-8 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 shadow-xl shadow-emerald-500/25 dark:shadow-emerald-500/10">
          {/* Bot icon with breathing glow ring */}
          <div className="relative mx-auto w-16 h-16 mb-5">
            <div className="absolute inset-0 rounded-full bg-white/20 animate-breathe" />
            <div className="relative w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Bot className="w-8 h-8 text-white" />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            PMEGP Interview
          </h2>
          <p className="text-emerald-100 text-sm leading-relaxed max-w-sm mx-auto">
            I&apos;ll help you build your PMEGP application step by step.
            Tell me about your business idea and I&apos;ll guide you through the entire process.
          </p>
        </div>
      </motion.div>

      {/* Welcome bot message bubble */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
        className="w-full max-w-lg mb-6"
      >
        <div className="flex items-start gap-3">
          {/* Bot avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            {/* Online status dot */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background dark:border-card" />
          </div>
          {/* Chat bubble */}
          <div className="rounded-2xl rounded-bl-md bg-card border shadow-sm px-4 py-3 text-left relative overflow-hidden">
            {/* Emerald left border accent */}
            <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-400" />
            <p className="text-sm text-foreground/90 leading-relaxed pl-1">
              Hello! I&apos;m your PMEGP Assistant. I&apos;ll help you build a complete project application step by step. Tell me about your business idea to get started.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Gradient line separator */}
      <div className="w-full max-w-lg mb-6">
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/60 dark:via-emerald-600/40 to-transparent" />
      </div>

      {/* Example prompts with shimmer borders */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <p className="text-sm font-medium text-muted-foreground mb-3">
          Try saying…
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {EXAMPLE_PROMPTS.map((prompt, i) => {
            const Icon = prompt.icon;
            return (
              <motion.button
                key={prompt.text}
                initial={{ opacity: 0, x: i % 2 === 0 ? -8 : 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.45 + i * 0.08 }}
                onClick={() => onSend(prompt.text)}
                className="group relative flex items-start gap-3 rounded-xl border border-border bg-card/80 hover:bg-card hover:border-emerald-300 dark:hover:border-emerald-700 px-4 py-3 text-left transition-all duration-200 hover:shadow-md hover:shadow-emerald-500/5 cursor-pointer overflow-hidden"
              >
                {/* Shimmer effect on hover */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-100/0 to-transparent dark:via-emerald-900/0 group-hover:via-emerald-100/40 dark:group-hover:via-emerald-900/20 pointer-events-none"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 0, ease: "linear" }}
                  whileHover={{
                    transition: { duration: 0.8, repeat: Infinity, ease: "linear" },
                  }}
                />
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mt-0.5 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors relative">
                  <Icon className="w-4 h-4 relative" />
                </div>
                <span className="text-sm text-foreground leading-snug relative">
                  {prompt.text}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Feature cards row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6"
        >
          {FEATURES.map((feature, i) => {
            const FeatureIcon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.8 + i * 0.08 }}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-3 py-3 text-center hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <FeatureIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-medium text-foreground/80 leading-tight">
                  {feature.title}
                </span>
                <span className="text-[10px] text-muted-foreground/70 leading-tight hidden sm:block">
                  {feature.description}
                </span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Tip at the bottom */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.1 }}
          className="mt-5 text-xs text-muted-foreground/60 text-center"
        >
          💡 You can also type freely — I&apos;ll understand your intent
        </motion.p>
      </motion.div>
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

// ── Error display component ─────────────────────────────────────────────────

function ErrorDisplay({
  error,
  onRetry,
  onStartOver,
}: {
  error: string;
  onRetry: () => void;
  onStartOver: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50/80 dark:bg-red-950/20 p-4 space-y-3"
    >
      {/* Error header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            Something went wrong
          </p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5 leading-relaxed">
            {error}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pl-11">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="text-xs h-8 gap-1.5 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-800 dark:hover:text-red-200 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStartOver}
          className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          Start Over
        </Button>
      </div>
    </motion.div>
  );
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
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Load chat history on mount
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const history = await fetchChatHistory(projectId);
        if (cancelled) return;

        if (history.length > 0) {
          setMessages(history);
        }
        setHistoryLoaded(true);
      } catch (err) {
        // Silently ignore history load errors — user sees a fresh chat
        if (!cancelled) setHistoryLoaded(true);
      }
    }

    // Only load history if the project already has interactions
    if (initialProfile && initialProfile.completion.interactionCount > 0) {
      loadHistory();
    } else {
      setHistoryLoaded(true);
    }

    return () => {
      cancelled = true;
    };
  }, [projectId, initialProfile]);

  // Handle stream abort (stop button)
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, []);

  // Send a message and handle the response (with streaming)
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

      // Create an AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Create a placeholder AI message for streaming into
      const aiMsgId = `ai-${Date.now()}`;
      const currentPhase = interviewState?.currentPhase ?? "APPLICANT_DISCOVERY";
      const streamingMsg: ChatMessage = {
        id: aiMsgId,
        role: "ASSISTANT",
        content: "",
        timestamp: new Date().toISOString(),
        phase: currentPhase,
      };

      // Add the empty AI message immediately (will be updated via streaming)
      setMessages((prev) => [...prev, streamingMsg]);

      try {
        const result = await streamChatMessage(
          projectId,
          text,
          // onChunk: update the streaming message content
          (cumulativeContent: string) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, content: cumulativeContent }
                  : m
              )
            );
          },
          abortController.signal,
        );

        // Stream completed successfully — update with final metadata
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId && result.message
              ? {
                  ...m,
                  id: result.message.id || aiMsgId,
                  content: result.message.content || m.content,
                  targetField: result.message.targetField,
                  extractions: result.message.extractions,
                  phase: result.message.phase || m.phase,
                }
              : m
          )
        );

        if (result.profile) {
          setProfile(result.profile);
        }
        if (result.state) {
          setInterviewState(result.state);

          // If we've reached the REVIEW phase, notify parent with the latest profile
          if (result.state.currentPhase === "REVIEW" && !result.state.isComplete && result.profile) {
            onEnterReview(result.profile);
          }
        }
      } catch (err) {
        // Check if it was an abort
        if (err instanceof Error && err.name === "AbortError") {
          // User clicked stop — keep whatever content was streamed
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId && m.content === ""
                ? prev[prev.length - 2]?.role === "USER"
                  ? { ...m, id: prev.length - 2 <= 0 ? m.id : m.id }
                  : m
                : m
            )
          );
          // Remove the empty placeholder if nothing was streamed
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.id === aiMsgId && lastMsg.content === "") {
              return prev.slice(0, -1);
            }
            return prev;
          });
          return;
        }

        // Remove the empty streaming placeholder on error
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.id === aiMsgId && lastMsg.content === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });

        // Fall back to non-streaming on stream failure
        try {
          const res = await sendChatMessage(projectId, text);

          // Remove the streaming placeholder and add the real message
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== aiMsgId);
            if (res.message) {
              return [...filtered, res.message];
            }
            return filtered;
          });

          if (res.profile) setProfile(res.profile);
          if (res.state) {
            setInterviewState(res.state);
            if (res.state.currentPhase === "REVIEW" && !res.state.isComplete && res.profile) {
              onEnterReview(res.profile);
            }
          }
        } catch (fallbackErr) {
          const msg = fallbackErr instanceof Error ? fallbackErr.message : "Something went wrong. Please try again.";
          setError(msg);
          toast.error("Error", { description: msg });
          notificationCenter.add("Interview Error", msg, "error");
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [projectId, interviewState, onEnterReview]
  );

  // Handle retry
  const handleRetry = useCallback(() => {
    // Remove last user message and clear error
    setMessages((prev) => prev.slice(0, -1));
    setError(null);
  }, []);

  // Handle start over
  const handleStartOver = useCallback(() => {
    setMessages([]);
    setError(null);
    setLoading(false);
    setInterviewState(null);
    setProfile(initialProfile ?? null);
    toast.success("Conversation cleared", {
      description: "Starting fresh with a new interview.",
    });
  }, [initialProfile]);

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

  // Whether we should show the welcome screen
  const showWelcome = messages.length === 0 && !loading && historyLoaded;

  return (
    <div className="flex flex-col h-[calc(100vh-1px)] sm:h-screen bg-background">
      {/* ── Chat Header ─────────────────────────────────────────── */}
      <header className="border-b border-border/60 bg-card/90 backdrop-blur-xl shrink-0 shadow-[0_1px_2px_0_rgb(0_0_0/0.04)]">
        <div className="max-w-4xl mx-auto px-3 py-3 sm:px-4 sm:py-3.5 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onGoBack}
            aria-label="Back to dashboard"
            className="shrink-0 hover:bg-muted/80"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-sm shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
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
                className="hidden sm:inline-flex shrink-0 text-xs gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
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
          {showWelcome && (
            <WelcomeScreen onSend={handleSend} />
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                index={idx}
                previousMessage={idx > 0 ? messages[idx - 1] : undefined}
                onSuggestionClick={handleSuggestionClick}
              />
            ))}
          </AnimatePresence>

          {loading && messages.length > 0 && messages[messages.length - 1]?.content === "" && (
            <ThinkingIndicator currentPhase={currentPhase} />
          )}

          {error && (
            <ErrorDisplay
              error={error}
              onRetry={handleRetry}
              onStartOver={handleStartOver}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input Area (sticky bottom) ──────────────────────────── */}
      <ChatInput
        onSend={handleSend}
        disabled={loading}
        onStop={handleStop}
      />
    </div>
  );
}