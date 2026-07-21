"use client";

import { motion } from "framer-motion";
import {
  Plus,
  MessageSquare,
  ShieldCheck,
  FileText,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const steps = [
  {
    step: 1,
    icon: Plus,
    title: "Create Project",
    description: "Start a new PMEGP application with a single click",
  },
  {
    step: 2,
    icon: MessageSquare,
    title: "AI Interview",
    description:
      "Answer simple questions — our AI builds your complete profile",
  },
  {
    step: 3,
    icon: ShieldCheck,
    title: "Review & Confirm",
    description: "Verify all details, check eligibility, review financials",
  },
  {
    step: 4,
    icon: FileText,
    title: "Get DPR",
    description: "Download your Detailed Project Report ready for submission",
  },
  {
    step: 5,
    icon: Rocket,
    title: "Submit & Track",
    description:
      "Submit to KVIC/KVIB/DRDA and track your application status",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const stepVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

/** Animated connecting dots for mobile timeline */
function MobileConnectingDots() {
  const dotCount = 4;
  return (
    <div className="absolute left-5 top-8 bottom-8 z-0 flex flex-col items-center justify-between py-2">
      {Array.from({ length: dotCount * 3 }).map((_, i) => (
        <motion.span
          key={i}
          className="block h-1 w-1 rounded-full bg-emerald-400 dark:bg-emerald-500"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.6, 1, 0.6] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/** Animated gradient connection line for desktop between steps */
function DesktopGradientConnection({ index }: { index: number }) {
  return (
    <div className="absolute left-[calc(50%+24px)] top-5 right-0 z-0 overflow-hidden hidden lg:block">
      <motion.div
        className="h-[2px] w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{
          duration: 0.6,
          delay: 0.3 + index * 0.15,
          ease: "easeOut" as const,
        }}
        style={{ transformOrigin: "left" }}
      />
      {/* Pulse overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "200%" }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          delay: 0.5 + index * 0.2,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section
      className="relative rounded-xl border border-t-2 border-t-emerald-500 bg-card p-6 overflow-hidden"
      aria-labelledby="how-it-works-title"
    >
      {/* Dot grid background pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
        aria-hidden="true"
      />

      {/* Section header */}
      <div className="relative mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-emerald-500" />
        <h2
          id="how-it-works-title"
          className="text-lg font-semibold"
        >
          How It Works
        </h2>
        <Badge
          variant="secondary"
          className="ml-2 gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-400"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          10L+ Projects Assisted
        </Badge>
      </div>

      {/* Mobile: vertical timeline */}
      <motion.div
        className="relative lg:hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Animated connecting dots (replaces dashed line) */}
        <MobileConnectingDots />

        <div className="relative z-10 flex flex-col gap-8">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.step}
                variants={stepVariants}
                className="relative flex gap-4"
              >
                {/* Step number circle with glow */}
                <div className="relative z-10 shrink-0">
                  <div
                    className="absolute inset-0 rounded-full bg-emerald-400/40 blur-md dark:bg-emerald-500/30"
                    aria-hidden="true"
                  />
                  <div
                    className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-sm font-bold text-white shadow-md"
                    aria-hidden="true"
                  >
                    {item.step}
                  </div>
                </div>

                {/* Content card */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="flex-1 rounded-lg border bg-background/50 p-4 transition-shadow hover:shadow-md"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-semibold">{item.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Desktop: horizontal timeline */}
      <motion.div
        className="hidden lg:block"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="grid grid-cols-5 gap-0">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === steps.length - 1;

            return (
              <motion.div
                key={item.step}
                variants={stepVariants}
                className="relative flex flex-col items-center text-center"
              >
                {/* Animated gradient connection (except after last step) */}
                {!isLast && <DesktopGradientConnection index={index} />}

                {/* Step number circle with glow */}
                <div className="relative z-10 mb-3">
                  <div
                    className="absolute inset-0 rounded-full bg-emerald-400/30 blur-lg dark:bg-emerald-500/20"
                    aria-hidden="true"
                  />
                  <div
                    className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-sm font-bold text-white shadow-md"
                    aria-hidden="true"
                  >
                    {item.step}
                  </div>
                </div>

                {/* Card */}
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="w-full rounded-lg border bg-background/50 p-4 transition-shadow hover:shadow-md"
                >
                  <Icon className="mx-auto mb-2 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <p className="mb-1 text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </motion.div>

                {/* Arrow between cards */}
                {!isLast && (
                  <div className="absolute -right-3 top-5 z-10 hidden text-emerald-400 lg:block">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 6H10M10 6L7 3M10 6L7 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}