"use client";

import { useState } from "react";
import { Chat } from "@/components/chat";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Github, 
  ExternalLink, 
  HelpCircle, 
  FolderTree, 
  Cpu, 
  Zap, 
  Code2, 
  Database, 
  Shield,
  ChevronRight,
  Terminal,
  FileCode,
  Layers
} from "lucide-react";

export default function Home() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-base text-foreground tracking-tight">
              SF 311 & FBI Crime Data Explorer
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline border border-border/50 px-1.5 py-0.5 rounded">
              powered by Daemo
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setHelpOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Dev Guide</span>
            </button>
            <a
              href="https://app.daemo.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Daemo Dashboard</span>
            </a>
            <a
              href="https://github.com/Daemo-AI/daemo-sf-311-agent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* Info Banner */}
      <div className="border-b border-border/30 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">What is this?</span>{" "}
                An AI-powered data assistant that queries real-time public APIs using the{" "}
                <a href="https://app.daemo.ai" className="text-zinc-400 hover:text-zinc-300 underline underline-offset-2">
                  Daemo Engine
                </a>
                . Ask natural language questions about city services and crime data.
              </p>
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Database className="h-3.5 w-3.5" />
                  <span>
                    <span className="text-zinc-400">SF 311 API</span> — City service requests, street cleaning, graffiti reports
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  <span>
                    <span className="text-zinc-400">FBI Crime Data</span> — Arrest stats, hate crimes, police employment
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        <Chat />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-3 px-4 text-center">
        <p className="text-xs text-muted-foreground">
          Built with{" "}
          <a
            href="https://github.com/Daemo-AI/daemo-sf-311-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            Daemo Engine
          </a>
          {" "}— An engine for building AI agents with function-calling capabilities{" • "}
          <a
            href="https://app.daemo.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            Get your API key
          </a>
        </p>
      </footer>

      {/* Developer Help Drawer */}
      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent side="right" className="w-[480px] max-w-[95vw]">
          <SheetHeader className="border-b-0 pb-2">
            <SheetTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-amber-500" />
              Developer Guide
            </SheetTitle>
            <SheetDescription>
              Understanding this repo and the Daemo Engine
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="flex-1 h-[calc(100vh-100px)]">
            <div className="px-6 py-4 space-y-6">
              
              {/* What This Repo Does */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  What This Repo Does
                </h3>
                <div className="bg-secondary/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
                  <p>
                    This is a <span className="text-foreground font-medium">template for building AI agents</span> with 
                    function-calling capabilities. The AI can dynamically call TypeScript functions you define.
                  </p>
                  <p>
                    It demonstrates querying two real APIs: <span className="text-zinc-400">SF 311</span> (city service requests) 
                    and <span className="text-zinc-400">FBI Crime Data Explorer</span>.
                  </p>
                </div>
              </section>

              {/* How Daemo Works */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-blue-400" />
                  How Daemo Engine Works
                </h3>
                <div className="space-y-3">
                  <div className="bg-secondary/50 rounded-lg p-4 text-sm text-muted-foreground">
                    <ol className="space-y-2 list-decimal list-inside">
                      <li>You define functions with <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">@DaemoFunction</code> decorators</li>
                      <li>Daemo registers them with Zod schemas for input/output validation</li>
                      <li>The LLM sees your functions as tools it can call</li>
                      <li>When called, Daemo executes your function and returns results to the LLM</li>
                    </ol>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                    <span className="px-2 py-1 bg-secondary rounded">User Query</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="px-2 py-1 bg-secondary rounded">LLM</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded">Daemo</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="px-2 py-1 bg-secondary rounded">Your Functions</span>
                  </div>
                </div>
              </section>

              {/* Project Structure */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-green-400" />
                  Project Structure
                </h3>
                <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs space-y-1">
                  <div className="text-muted-foreground">
                    <span className="text-zinc-400">src/</span>
                    <span className="text-muted-foreground/60"> ← Backend (Express + TS)</span>
                  </div>
                  <div className="pl-4 text-muted-foreground">
                    <span className="text-zinc-500">├─</span> app.ts
                    <span className="text-muted-foreground/60"> — Entry point</span>
                  </div>
                  <div className="pl-4 text-muted-foreground">
                    <span className="text-zinc-500">├─</span> controllers/
                    <span className="text-muted-foreground/60"> — API routes</span>
                  </div>
                  <div className="pl-4 text-amber-400/80">
                    <span className="text-zinc-500">├─</span> services/
                    <span className="text-amber-400/60"> — ⭐ YOUR CODE HERE</span>
                  </div>
                  <div className="pl-8 text-muted-foreground">
                    <span className="text-zinc-500">├─</span> daemoService.ts
                    <span className="text-muted-foreground/60"> — Register services</span>
                  </div>
                  <div className="pl-8 text-muted-foreground">
                    <span className="text-zinc-500">├─</span> sf311Functions.ts
                    <span className="text-muted-foreground/60"> — SF 311 functions</span>
                  </div>
                  <div className="pl-8 text-muted-foreground">
                    <span className="text-zinc-500">├─</span> fbiFunctions.ts
                    <span className="text-muted-foreground/60"> — FBI functions</span>
                  </div>
                  <div className="pl-8 text-muted-foreground">
                    <span className="text-zinc-500">└─</span> *.schemas.ts
                    <span className="text-muted-foreground/60"> — Zod schemas</span>
                  </div>
                  <div className="text-muted-foreground mt-3">
                    <span className="text-zinc-400">client/</span>
                    <span className="text-muted-foreground/60"> ← Frontend (Next.js 15)</span>
                  </div>
                </div>
              </section>

              {/* Available Functions */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-400" />
                  Available Functions
                </h3>
                
                {/* SF 311 Functions */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-zinc-400">SF 311 (4 functions)</span>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                    <FunctionItem 
                      name="searchOrAggregate" 
                      desc="General SoQL queries for counts, grouping, searches"
                    />
                    <FunctionItem 
                      name="analyzeCycleTimes" 
                      desc="Avg/median time to close cases by service type"
                    />
                    <FunctionItem 
                      name="analyzeResubmissions" 
                      desc="Find 'zombie' cases reopened within 7 days"
                    />
                    <FunctionItem 
                      name="findIntersections" 
                      desc="Search intersection-specific requests"
                    />
                  </div>
                </div>

                {/* FBI Functions */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs font-medium text-zinc-400">FBI Crime Data (10 functions)</span>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                    <FunctionItem 
                      name="getAgencies" 
                      desc="List law enforcement agencies by state (get ORI codes)"
                    />
                    <FunctionItem 
                      name="getSummarizedData" 
                      desc="SRS crime trends from 1960+ (homicide, robbery, etc.)"
                    />
                    <FunctionItem 
                      name="getNIBRSData" 
                      desc="Detailed incident data from 1991+ by offense code"
                    />
                    <FunctionItem 
                      name="getArrestData" 
                      desc="Arrest counts by offense type"
                    />
                    <FunctionItem 
                      name="getHateCrimeData" 
                      desc="Hate crimes filtered by bias motivation"
                    />
                    <FunctionItem 
                      name="getPoliceEmployment" 
                      desc="Officer vs civilian counts over time"
                    />
                    <div className="text-xs text-muted-foreground/60 pt-1">
                      + 4 more: getNIBRSEstimation, getSupplementalData, getSHRData, getParticipationData
                    </div>
                  </div>
                </div>
              </section>

              {/* Quick Start */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  Add Your Own Function
                </h3>
                <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs text-muted-foreground overflow-x-auto">
                  <pre className="whitespace-pre">{`// 1. Create in src/services/myService.ts
@DaemoFunction({
  description: "Get weather for a city",
  inputSchema: z.object({
    city: z.string()
  }),
  outputSchema: z.object({
    temp: z.number()
  }),
})
async getWeather(input: { city: string }) {
  // Your logic here
  return { temp: 72 };
}

// 2. Register in daemoService.ts
builder.registerService(new MyService());`}</pre>
                </div>
              </section>

              {/* Links */}
              <section className="pb-6">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-cyan-400" />
                  Resources
                </h3>
                <div className="space-y-2">
                  <a 
                    href="https://app.daemo.ai" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <ExternalLink className="h-4 w-4 group-hover:text-amber-500" />
                    Get your Daemo API key
                  </a>
                  <a 
                    href="https://github.com/Daemo-AI/daemo-sf-311-agent" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <Github className="h-4 w-4 group-hover:text-amber-500" />
                    View source on GitHub
                  </a>
                  <a 
                    href="https://dev.socrata.com/docs/app-tokens.html" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <Database className="h-4 w-4 group-hover:text-blue-400" />
                    SF 311 / Socrata API docs
                  </a>
                  <a 
                    href="https://cde.ucr.cjis.gov/LATEST/webapp/#/pages/docApi" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <Shield className="h-4 w-4 group-hover:text-red-400" />
                    FBI Crime Data Explorer docs
                  </a>
                </div>
              </section>

            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FunctionItem({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex items-start gap-2">
      <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded text-zinc-300 shrink-0">{name}</code>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </div>
  );
}
