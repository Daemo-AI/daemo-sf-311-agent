import { Chat } from "@/components/chat";
import { Zap, Github, ExternalLink } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col animated-bg">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-2 rounded-lg shadow-lg shadow-purple-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg gradient-text">Daemo</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">AI Agent Template</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <a
              href="https://app.daemo.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </a>
            <a
              href="https://github.com/daemo-ai"
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

      {/* Main Chat Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto flex flex-col">
        <Chat />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4 px-4 text-center">
        <p className="text-xs text-muted-foreground">
          Built with{" "}
          <a
            href="https://github.com/daemo-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Daemo Engine
          </a>
          {" • "}
          <a
            href="https://app.daemo.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Get your API key
          </a>
        </p>
      </footer>
    </div>
  );
}
