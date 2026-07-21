"use client";

import { Separator } from "@/components/ui/separator";
import { Info, IndianRupee, MapPin, Users, Building2, BookOpen } from "lucide-react";

const SCHEME_DATA = [
  {
    icon: IndianRupee,
    label: "Maximum Project Cost",
    value: "₹25,00,000",
    detail: "Upper limit for any PMEGP project",
  },
  {
    icon: Users,
    label: "Beneficiary Age",
    value: "18–65 years",
    detail: "Eligible age range for applicants",
  },
  {
    icon: MapPin,
    label: "Rural Subsidy",
    value: "25% (Gen) / 35% (Special)",
    detail: "Special: SC/ST, Women, Ex-Serviceman, PH",
  },
  {
    icon: Building2,
    label: "Urban Subsidy",
    value: "15% (Gen) / 25% (Special)",
    detail: "Lower rates for urban area projects",
  },
  {
    icon: BookOpen,
    label: "Sectors Covered",
    value: "Manufacturing & Services",
    detail: "Excludes retail, trading, and negative list items",
  },
  {
    icon: Info,
    label: "Implementing Agency",
    value: "KVIC / State KVIB",
    detail: "Khadi & Village Industries Commission",
  },
];

export function SchemeInfo() {
  return (
    <div className="space-y-1">
      {SCHEME_DATA.map((item, idx) => (
        <div key={item.label}>
          <div className="flex items-start gap-3 py-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
              <item.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold mt-0.5">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
            </div>
          </div>
          {idx < SCHEME_DATA.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}