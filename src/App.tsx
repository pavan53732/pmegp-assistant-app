// ─── App Shell (Wave 4) ────────────────────────────────────────────────────
// Replaces the Wave 1 scaffold. Wires every feature module into a router
// with a top header + left sidebar (desktop) / bottom tab bar (mobile) +
// sticky footer.
//
// Routes:
//   /                              Dashboard
//   /project/:id                   Project Profile (read + JSON edit)
//   /project/:id/guided            Guided Forms wizard (AI-interview fallback)
//   /project/:id/financial         Financial Review (computeFinancials + charts)
//   /project/:id/eligibility       Eligibility (checkEligibility + checklist)
//   /project/:id/dpr               DPR Preview (generateDPR + PDF download)
//   /knowledge                     Knowledge Search
//   /ocr                           OCR Capture
//   /settings                      Settings
//   *                              → redirect to /
//
// Layout:
//   • <html class="dark"> already set (see index.html).
//   • min-h-screen flex flex-col, footer mt-auto (sticky to bottom on short
//     pages).
//   • Desktop: header on top + persistent left sidebar (md:flex). Mobile:
//     header on top + bottom tab bar (fixed). 44px+ touch targets
//     everywhere (min-h-11 buttons).
// ───────────────────────────────────────────────────────────────────────────

import { NavLink, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Search,
  Camera,
  Settings as SettingsIcon,
  IndianRupee,
} from "lucide-react";

import { DashboardScreen } from "@/features/dashboard/DashboardScreen";
import { ProjectProfileScreen } from "@/features/project-profile/ProjectProfileScreen";
import { FinancialScreen } from "@/features/financial/FinancialScreen";
import { EligibilityScreen } from "@/features/eligibility/EligibilityScreen";
import { DprScreen } from "@/features/dpr/DprScreen";
import { KnowledgeScreen } from "@/features/knowledge/KnowledgeScreen";
import { OcrScreen } from "@/features/ocr/OcrScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { GuidedFormsWizard } from "@/features/guided-forms";
// Wave 6: biometric unlock gate. Wraps <Routes> below so the entire app
// content is gated on native (fingerprint / face / PIN). On web (dev) the
// gate is a pass-through. See src/features/biometric/.
import { BiometricGate } from "@/features/biometric";

// ── Navigation items ────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/knowledge", label: "Knowledge", icon: Search },
  { to: "/ocr", label: "OCR", icon: Camera },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

// ── Shell layout ────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 mx-auto w-full max-w-6xl px-4 py-6 pb-24 md:pb-10">
          {children}
        </main>
      </div>
      <BottomTabBar />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-emerald-700 text-lg text-white shadow-sm">
          🏛️
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold leading-tight">
            PMEGP Assistant
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Offline-first · AI-first · Capacitor 8
          </p>
        </div>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          Wave 4 · Feature UI
        </Badge>
      </div>
    </header>
  );
}

function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:bg-sidebar md:p-3">
      <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Navigation
      </p>
      {PRIMARY_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            [
              "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            ].join(" ")
          }
        >
          <item.icon className="size-4" />
          {item.label}
        </NavLink>
      ))}
      <div className="mt-auto px-3 pt-4">
        <Card className="gap-2 py-3">
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <IndianRupee className="size-3.5" /> PMEGP scheme
            </p>
            <p>
              25-35% subsidy · 5-10% own contribution · ₹25L (service) / ₹50L
              (mfg) ceiling.
            </p>
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}

function BottomTabBar() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <ul className="mx-auto flex max-w-md items-stretch">
        {PRIMARY_NAV.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                ].join(" ")
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-3 text-xs text-muted-foreground">
        PMEGP Assistant · v1.0.0 · Stage B Wave 4 (feature UI shell)
      </div>
    </footer>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Shell>
      <BiometricGate>
        <Routes>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/project/:id" element={<ProjectProfileScreen />} />
          <Route path="/project/:id/guided" element={<GuidedFormsRoute />} />
          <Route path="/project/:id/financial" element={<FinancialScreen />} />
          <Route path="/project/:id/eligibility" element={<EligibilityScreen />} />
          <Route path="/project/:id/dpr" element={<DprScreen />} />
          <Route path="/knowledge" element={<KnowledgeScreen />} />
          <Route path="/ocr" element={<OcrScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<NavigateToDashboard />} />
        </Routes>
      </BiometricGate>
    </Shell>
  );
}

/** Redirect helper that preserves the current path (for debugging). */
function NavigateToDashboard() {
  const location = useLocation();
  // Log unknown routes so Wave 5 navigation bugs are easy to spot.
  console.warn(`[App] Unknown route "${location.pathname}" — redirecting to /.`);
  return <Navigate to="/" replace />;
}

/**
 * Route wrapper for the Guided Forms wizard. Pulls the `:id` URL param and
 * passes it to `<GuidedFormsWizard>` as the `projectId` prop. The wizard
 * itself stays route-agnostic so it can be unit-tested in isolation.
 */
function GuidedFormsRoute() {
  const { id = "" } = useParams<{ id: string }>();
  return <GuidedFormsWizard projectId={id} />;
}
