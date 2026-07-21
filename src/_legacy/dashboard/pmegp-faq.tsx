"use client";

import { motion } from "framer-motion";
import { HelpCircle, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "What is PMEGP?",
    answer:
      "PMEGP stands for Prime Minister's Employment Generation Programme. It's a credit-linked subsidy scheme by the Government of India, implemented through KVIC, KVIB, and State DRDAs, to generate employment in rural and urban areas by setting up micro-enterprises.",
  },
  {
    question: "Who is eligible for PMEGP?",
    answer:
      "Any individual above 18 years of age can apply. Special categories include Women (higher subsidy of 35%), SC/ST (25-35% subsidy), and beneficiaries in hill/border/aspirational districts. Applicants who have already availed PMEGP subsidy are not eligible again.",
  },
  {
    question: "What is the maximum project cost under PMEGP?",
    answer:
      "The maximum project cost is ₹25,00,000 (₹25 lakhs). For manufacturing units in rural areas, the limit is higher. The subsidy covers 15% to 35% of the project cost depending on category, sector, and location.",
  },
  {
    question: "How much subsidy can I get?",
    answer:
      "Subsidy rates vary: General category in urban areas get 15%, while SC/ST/Women in rural areas get up to 35%. The maximum subsidy amount is ₹12.50 lakhs for general category and higher for special categories in rural/hill areas.",
  },
  {
    question: "What documents are required?",
    answer:
      "Key documents include: Identity proof (Aadhaar/PAN), Address proof, Caste certificate (if applicable), Education qualification certificate, EDP training certificate, Land/rent agreement, Project Report (DPR), and Quotations for machinery.",
  },
  {
    question: "How long does the approval process take?",
    answer:
      "Typically 30-90 days from application submission. The timeline varies by implementing agency (KVIC/KVIB/DRDA) and completeness of your application. A well-prepared DPR can significantly speed up the process.",
  },
];

/** Gradient number badge shown on each FAQ item */
function FaqNumberBadge({ index }: { index: number }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white",
        "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm"
      )}
      aria-hidden="true"
    >
      {index + 1}
    </span>
  );
}

/** Custom trigger that overrides the default accordion chevron */
function FaqTrigger({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  return (
    <AccordionTrigger className="group relative gap-3 py-4 text-left hover:no-underline">
      <span className="flex items-start gap-3">
        <FaqNumberBadge index={index} />
        <span className="text-sm font-semibold leading-snug text-foreground/90 group-hover:text-foreground transition-colors">
          {children}
        </span>
      </span>
      <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-emerald-500 transition-transform duration-300 data-[state=open]:rotate-180" />
    </AccordionTrigger>
  );
}

export function PmegpFaq() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      aria-labelledby="faq-title"
    >
      <div className="rounded-xl border border-t-2 border-t-emerald-500 bg-card p-6">
        {/* Header */}
        <div className="mb-5 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-emerald-500" />
          <h2 id="faq-title" className="text-lg font-semibold">
            Frequently Asked Questions
          </h2>
        </div>

        {/* FAQ Accordion */}
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className={cn(
                "border-border/60 last:border-b-0 transition-colors duration-200",
                "data-[state=open]:border-l-2 data-[state=open]:border-l-emerald-500 data-[state=open]:pl-3 data-[state=open]:bg-emerald-50/40 dark:data-[state=open]:bg-emerald-950/10",
                "rounded-md"
              )}
            >
              <FaqTrigger index={index}>{faq.question}</FaqTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground pl-9">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </motion.section>
  );
}