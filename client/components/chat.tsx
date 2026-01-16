"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, AlertCircle, Wrench, CheckCircle2, XCircle, Brain, ChevronDown, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ToolCall {
  id: string;
  toolName: string;
  parameters: any;
  status: "pending" | "success" | "error";
  result?: any;
  errorMessage?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

const EXAMPLE_PROMPTS = [
  "Show me 311 incidents from the last week",
  "What graffiti reports were filed yesterday in SF?",
  "Get arrest data for California in 2023",
  "Show hate crime statistics by state",
];

// Beautiful sparkles icon for AI avatar
const SparklesIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    height={size}
    strokeLinejoin="round"
    style={{ color: "currentcolor" }}
    viewBox="0 0 16 16"
    width={size}
  >
    <path
      d="M2.5 0.5V0H3.5V0.5C3.5 1.60457 4.39543 2.5 5.5 2.5H6V3V3.5H5.5C4.39543 3.5 3.5 4.39543 3.5 5.5V6H3H2.5V5.5C2.5 4.39543 1.60457 3.5 0.5 3.5H0V3V2.5H0.5C1.60457 2.5 2.5 1.60457 2.5 0.5Z"
      fill="currentColor"
    />
    <path
      d="M14.5 4.5V5H13.5V4.5C13.5 3.94772 13.0523 3.5 12.5 3.5H12V3V2.5H12.5C13.0523 2.5 13.5 2.05228 13.5 1.5V1H14H14.5V1.5C14.5 2.05228 14.9477 2.5 15.5 2.5H16V3V3.5H15.5C14.9477 3.5 14.5 3.94772 14.5 4.5Z"
      fill="currentColor"
    />
    <path
      d="M8.40706 4.92939L8.5 4H9.5L9.59294 4.92939C9.82973 7.29734 11.7027 9.17027 14.0706 9.40706L15 9.5V10.5L14.0706 10.5929C11.7027 10.8297 9.82973 12.7027 9.59294 15.0706L9.5 16H8.5L8.40706 15.0706C8.17027 12.7027 6.29734 10.8297 3.92939 10.5929L3 10.5V9.5L3.92939 9.40706C6.29734 9.17027 8.17027 7.29734 8.40706 4.92939Z"
      fill="currentColor"
    />
  </svg>
);

// Tool call display component
function ToolCallDisplay({ toolCall, isExpanded, onToggle }: { 
  toolCall: ToolCall; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusIcon = {
    pending: <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />,
    success: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    error: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  }[toolCall.status];

  const statusColor = {
    pending: "border-amber-500/30 bg-amber-500/5",
    success: "border-emerald-500/30 bg-emerald-500/5",
    error: "border-red-500/30 bg-red-500/5",
  }[toolCall.status];

  return (
    <div className={`rounded-lg border ${statusColor} overflow-hidden transition-all duration-200`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-mono text-foreground flex-1">{toolCall.toolName}</span>
        {statusIcon}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-border/50">
              {/* Parameters */}
              <div className="pt-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Parameters</p>
                <pre className="text-xs bg-black/20 rounded p-2 overflow-x-auto font-mono text-zinc-400">
                  {JSON.stringify(toolCall.parameters, null, 2)}
                </pre>
              </div>
              
              {/* Result */}
              {toolCall.status === "success" && toolCall.result && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Result</p>
                  <pre className="text-xs bg-black/20 rounded p-2 overflow-x-auto font-mono text-emerald-400/80 max-h-40">
                    {typeof toolCall.result === 'string' 
                      ? toolCall.result 
                      : JSON.stringify(toolCall.result, null, 2).slice(0, 500) + (JSON.stringify(toolCall.result).length > 500 ? '...' : '')}
                  </pre>
                </div>
              )}
              
              {/* Error */}
              {toolCall.status === "error" && toolCall.errorMessage && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-red-400 mb-1">Error</p>
                  <pre className="text-xs bg-red-500/10 rounded p-2 overflow-x-auto font-mono text-red-400">
                    {toolCall.errorMessage}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentThought, setCurrentThought] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentThought]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "44px";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const toggleToolExpand = (toolId: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    // Create assistant message placeholder for streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      toolCalls: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);
    setCurrentThought(null);

    try {
      const response = await fetch("/api/agent/query-stream", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({ query: userMessage.content }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || errorData.message || "Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case "thought":
                  setCurrentThought(data.content);
                  break;

                case "toolCall":
                  // Add new tool call with pending status
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg.id === assistantMessageId) {
                      const newToolCall: ToolCall = {
                        id: `${data.toolName}-${Date.now()}`,
                        toolName: data.toolName,
                        parameters: data.parameters,
                        status: "pending",
                      };
                      lastMsg.toolCalls = [...(lastMsg.toolCalls || []), newToolCall];
                      // Auto-expand new tool calls
                      setExpandedTools(prev => new Set([...prev, newToolCall.id]));
                    }
                    return updated;
                  });
                  setCurrentThought(null);
                  break;

                case "toolResult":
                  // Update tool call with result
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg.id === assistantMessageId && lastMsg.toolCalls) {
                      // Find the most recent pending tool call with this name
                      const toolIndex = [...lastMsg.toolCalls].reverse().findIndex(
                        t => t.toolName === data.toolName && t.status === "pending"
                      );
                      if (toolIndex !== -1) {
                        const actualIndex = lastMsg.toolCalls.length - 1 - toolIndex;
                        lastMsg.toolCalls[actualIndex] = {
                          ...lastMsg.toolCalls[actualIndex],
                          status: data.success ? "success" : "error",
                          result: data.result,
                          errorMessage: data.errorMessage,
                        };
                      }
                    }
                    return updated;
                  });
                  break;

                case "finalResponse":
                  // Update message with final response
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg.id === assistantMessageId) {
                      lastMsg.content = data.response || "No response received.";
                      lastMsg.isStreaming = false;
                      // Add tool interactions if not already present
                      if (data.toolInteractions && data.toolInteractions.length > 0 && (!lastMsg.toolCalls || lastMsg.toolCalls.length === 0)) {
                        lastMsg.toolCalls = data.toolInteractions.map((t: any, i: number) => ({
                          id: `${t.toolName}-${i}`,
                          toolName: t.toolName,
                          parameters: t.parameters,
                          status: t.success ? "success" : "error",
                          result: t.result,
                          errorMessage: t.errorMessage,
                        }));
                      }
                    }
                    return updated;
                  });
                  setCurrentThought(null);
                  break;

                case "error":
                  throw new Error(data.error || "Stream error");
              }
            } catch (parseError) {
              // Ignore JSON parse errors for incomplete data
              if (line.trim() && !line.includes("event:")) {
                console.warn("Failed to parse SSE data:", line);
              }
            }
          } else if (line.startsWith("event: error")) {
            // Handle error event
            const dataLine = lines[lines.indexOf(line) + 1];
            if (dataLine?.startsWith("data: ")) {
              const errorData = JSON.parse(dataLine.slice(6));
              throw new Error(errorData.message || "Stream error");
            }
          } else if (line.startsWith("event: end")) {
            // Stream ended
            break;
          }
        }
      }

      // Mark streaming as complete
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg.id === assistantMessageId) {
          lastMsg.isStreaming = false;
          if (!lastMsg.content) {
            lastMsg.content = "No response received.";
          }
        }
        return updated;
      });

    } catch (err) {
      console.error("Stream error:", err);
      
      // Update the assistant message with error
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg.id === assistantMessageId) {
          lastMsg.isStreaming = false;
          lastMsg.content = "";
        }
        return updated;
      });

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          setError("Request timed out. The query took too long to process.");
        } else if (err.message.includes("ECONNRESET") || err.message.includes("UNAVAILABLE")) {
          setError("Connection was reset. The server is retrying... Please try again in a few seconds.");
        } else if (err.message.includes("Backend server is not running")) {
          setError("Backend server is not running. Run 'npm run dev' in the root directory.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
      setCurrentThought(null);
    }
  };

  const handleExampleClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages Area */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto"
        style={{ overflowAnchor: "none" }}
      >
        <div className="mx-auto max-w-3xl flex flex-col gap-4 md:gap-6 px-3 py-4 md:px-4">
          {messages.length === 0 ? (
            /* Greeting - Minimalist and elegant */
            <div className="mt-8 md:mt-12 px-2">
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.2 }}
                className="font-semibold text-xl md:text-2xl text-foreground"
              >
                Ask me anything about SF 311 or crime data
              </motion.div>
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.3 }}
                className="text-base md:text-lg text-zinc-500 mt-2 max-w-lg"
              >
                I can query San Francisco city service requests, graffiti reports, 
                street cleaning data, and FBI crime statistics in real-time.
              </motion.div>

              {/* Suggested prompts */}
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.4 }}
                className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2"
              >
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleExampleClick(prompt)}
                    className="group text-left p-3 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-zinc-600 transition-all duration-200"
                  >
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {prompt}
                    </span>
                  </button>
                ))}
              </motion.div>
            </div>
          ) : (
            messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group/message w-full"
                data-role={message.role}
              >
                <div
                  className={`flex w-full items-start gap-2 md:gap-3 ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {/* AI Avatar */}
                  {message.role === "assistant" && (
                    <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
                      <SparklesIcon size={14} />
                    </div>
                  )}

                  {/* Message Content */}
                  <div
                    className={`flex flex-col gap-3 ${
                      message.role === "user"
                        ? "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]"
                        : "w-full max-w-[calc(100%-3rem)]"
                    }`}
                  >
                    {message.role === "user" ? (
                      <div
                        className="w-fit break-words rounded-2xl px-3 py-2 text-left text-white"
                        style={{ backgroundColor: "#006cff" }}
                      >
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                    ) : (
                      <>
                        {/* Tool Calls */}
                        {message.toolCalls && message.toolCalls.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Wrench className="h-3 w-3" />
                              Tool Calls ({message.toolCalls.length})
                            </p>
                            <div className="space-y-1.5">
                              {message.toolCalls.map((toolCall) => (
                                <ToolCallDisplay
                                  key={toolCall.id}
                                  toolCall={toolCall}
                                  isExpanded={expandedTools.has(toolCall.id)}
                                  onToggle={() => toggleToolExpand(toolCall.id)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Response Content */}
                        {message.content && (
                          <div className="prose-chat text-sm">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        )}
                        
                        {/* Streaming indicator */}
                        {message.isStreaming && !message.content && !currentThought && (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Processing...</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}

          {/* Thinking indicator */}
          <AnimatePresence mode="wait">
            {currentThought && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-start gap-3"
              >
                <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
                  <Brain className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-purple-400 mb-1">Thinking</p>
                  <p className="text-sm text-purple-300/90">{currentThought}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading indicator (when no thought is showing) */}
          <AnimatePresence mode="wait">
            {isLoading && !currentThought && messages[messages.length - 1]?.role === "user" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.3 } }}
                className="group/message w-full"
              >
                <div className="flex items-start justify-start gap-3">
                  <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
                    <SparklesIcon size={14} />
                  </div>
                  <div className="flex w-full flex-col gap-2 md:gap-4">
                    <div className="p-0 text-muted-foreground text-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 items-start"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <div className="text-destructive text-sm">
                <p className="font-medium">Error</p>
                <p className="opacity-90">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Scroll padding */}
          <div className="min-h-[24px] min-w-[24px] shrink-0" />
        </div>
      </div>

      {/* Input Area - Sticky bottom */}
      <div className="sticky bottom-0 z-10 mx-auto flex w-full max-w-3xl gap-2 border-t-0 bg-background px-3 pb-3 md:px-4 md:pb-4">
        <form onSubmit={handleSubmit} className="relative flex w-full flex-col gap-4">
          <div className="relative">
            <div className="rounded-xl border border-border bg-background p-3 shadow-sm transition-all duration-200 focus-within:border-zinc-600 hover:border-zinc-700">
              <div className="flex flex-row items-start gap-1 sm:gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send a message..."
                  className="grow resize-none border-0 bg-transparent p-2 text-sm outline-none ring-0 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 min-h-[44px] max-h-[200px]"
                  rows={1}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="size-8 rounded-full bg-foreground text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" style={{ transform: "rotate(-45deg)" }} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
