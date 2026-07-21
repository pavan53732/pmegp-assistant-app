import { Routes, Route, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">🏛️</span>
          <div className="flex-1">
            <h1 className="text-base font-semibold leading-tight">PMEGP Assistant</h1>
            <p className="text-xs text-muted-foreground">Offline-first · AI-first · Capacitor 7</p>
          </div>
          <Badge variant="secondary">Wave 1 · Scaffold</Badge>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6">{children}</main>
      <footer className="mt-auto border-t bg-card">
        <div className="mx-auto max-w-5xl px-4 py-3 text-xs text-muted-foreground">
          PMEGGP Assistant · v1.0.0 · Stage B (Wave 1 scaffold)
        </div>
      </footer>
    </div>
  );
}

function Home() {
  return (
    <Shell>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Architectural Correction — Complete</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>✅ Next.js removed · Vite + React 19 active</p>
            <p>✅ Prisma removed · Capacitor SQLite (SQLCipher) layer added</p>
            <p>✅ pdfkit removed · pdf-lib ready (Wave 2 rewrite)</p>
            <p>✅ z-ai-web-dev-sdk removed · providers use raw fetch to user's AI</p>
            <p>✅ Capacitor 7 configured (appId <code>com.pmegp.assistant</code>)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Waves Remaining</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1 text-muted-foreground">
            <p>Wave 2 — 3 new engines + PDF/OCR rewrite</p>
            <p>Wave 3 — AI Writer + Guided Forms + Settings</p>
            <p>Wave 4 — 8 feature UI modules</p>
            <p>Wave 5 — Security hardening + tests + APK pipeline</p>
            <Link to="/engines" className="inline-block mt-2 text-primary underline">
              View engine status →
            </Link>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Engines() {
  const engines = [
    { name: "Validation", status: "Preserved", tests: 30 },
    { name: "Financial", status: "Preserved", tests: 21 },
    { name: "Eligibility", status: "Preserved", tests: 17 },
    { name: "Knowledge", status: "Preserved", tests: 25 },
    { name: "DPR", status: "Preserved", tests: 0 },
    { name: "PDF", status: "Wave 2 rewrite (pdf-lib)", tests: 0 },
    { name: "OCR", status: "Wave 2 rewrite (Tesseract WASM)", tests: 0 },
    { name: "Import/Export", status: "Wave 2 — new", tests: 0 },
    { name: "Update", status: "Wave 2 — new", tests: 0 },
    { name: "Project", status: "Wave 2 — new", tests: 0 },
  ];
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>Engine Status (10 total)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {engines.map((e) => (
              <li key={e.name} className="flex justify-between border-b py-1.5">
                <span className="font-medium">{e.name}</span>
                <span className="text-muted-foreground">
                  {e.status} · {e.tests} tests
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </Shell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/engines" element={<Engines />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
