"use client";

import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

interface EligibilityResult {
  criterion: string;
  passed: boolean;
  detail: string;
}

export function EligibilityChecker() {
  const [age, setAge] = useState<string>("");
  const [category, setCategory] = useState<string>("GENERAL");
  const [education, setEducation] = useState<string>("");
  const [priorSubsidy, setPriorSubsidy] = useState<string>("NO");
  const [checked, setChecked] = useState(false);

  const results = useMemo((): EligibilityResult[] => {
    if (!checked) return [];
    const ageNum = parseInt(age, 10);
    const criteria: EligibilityResult[] = [];

    // Age check: 18-65
    if (ageNum >= 18 && ageNum <= 65) {
      criteria.push({
        criterion: "Age Requirement",
        passed: true,
        detail: `Age ${ageNum} is within the eligible range (18–65 years).`,
      });
    } else {
      criteria.push({
        criterion: "Age Requirement",
        passed: false,
        detail: ageNum < 18
          ? `Age ${ageNum} is below the minimum age of 18.`
          : ageNum > 65
            ? `Age ${ageNum} is above the maximum age of 65.`
            : "Please enter a valid age.",
      });
    }

    // Category check — all categories are eligible
    criteria.push({
      criterion: "Category Eligibility",
      passed: true,
      detail: `${category === "GENERAL" ? "General" : category} applicants are eligible under PMEGP. Special categories (SC/ST, Women, Ex-Serviceman, Physically Handicapped) get higher subsidy rates.`,
    });

    // Education check
    if (education) {
      const hasEdu =
        education !== "NONE" &&
        education !== "ILLITERATE";
      criteria.push({
        criterion: "Education Qualification",
        passed: hasEdu,
        detail: hasEdu
          ? `${education} qualification is acceptable for PMEGP.`
          : "At least basic literacy is recommended for PMEGP applicants to manage the enterprise.",
      });
    } else {
      criteria.push({
        criterion: "Education Qualification",
        passed: true,
        detail: "Education level not specified. Basic literacy is recommended but not strictly mandatory.",
      });
    }

    // Prior subsidy check
    if (priorSubsidy === "NO") {
      criteria.push({
        criterion: "Prior Government Subsidy",
        passed: true,
        detail: "No prior government subsidy received. You are eligible.",
      });
    } else {
      criteria.push({
        criterion: "Prior Government Subsidy",
        passed: false,
        detail: "Applicants who have already availed subsidy under PMEGP or any other government scheme for self-employment are NOT eligible.",
      });
    }

    return criteria;
  }, [age, category, education, priorSubsidy, checked]);

  const allPassed = results.length > 0 && results.every((r) => r.passed);

  const handleReset = () => {
    setAge("");
    setCategory("GENERAL");
    setEducation("");
    setPriorSubsidy("NO");
    setChecked(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="elig-age" className="text-xs font-medium">
            Age
          </Label>
          <Input
            id="elig-age"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 30"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min={1}
            max={100}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GENERAL">General</SelectItem>
              <SelectItem value="SC/ST">SC / ST</SelectItem>
              <SelectItem value="OBC">OBC</SelectItem>
              <SelectItem value="MINORITY">Minority</SelectItem>
              <SelectItem value="WOMEN">Women</SelectItem>
              <SelectItem value="EX-SERVICEMAN">Ex-Serviceman</SelectItem>
              <SelectItem value="PHYSICALLY_HANDICAPPED">Physically Handicapped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Education</Label>
          <Select value={education} onValueChange={setEducation}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ILLITERATE">Illiterate</SelectItem>
              <SelectItem value="PRIMARY">Primary (1–5)</SelectItem>
              <SelectItem value="MIDDLE">Middle (6–8)</SelectItem>
              <SelectItem value="MATRIC">Matric (10th)</SelectItem>
              <SelectItem value="HIGHER_SECONDARY">Higher Secondary (12th)</SelectItem>
              <SelectItem value="GRADUATE">Graduate</SelectItem>
              <SelectItem value="POST_GRADUATE">Post Graduate</SelectItem>
              <SelectItem value="PROFESSIONAL">Professional Degree</SelectItem>
              <SelectItem value="ITI">ITI / Diploma</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Prior Govt. Subsidy</Label>
          <Select value={priorSubsidy} onValueChange={setPriorSubsidy}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NO">No</SelectItem>
              <SelectItem value="YES">Yes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setChecked(true)}
          disabled={!age}
        >
          <ShieldCheck className="h-4 w-4 mr-1.5" />
          Check Eligibility
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset}>
          Reset
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {allPassed && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                You appear eligible for PMEGP!
              </span>
            </div>
          )}

          {!allPassed && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-3 py-2.5">
              <XCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-sm font-medium text-red-800 dark:text-red-300">
                There are eligibility concerns. See details below.
              </span>
            </div>
          )}

          <div className="space-y-2">
            {results.map((r) => (
              <div
                key={r.criterion}
                className="flex items-start gap-2.5 rounded-md border bg-card px-3 py-2.5 text-sm"
              >
                {r.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="font-medium text-xs">{r.criterion}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}