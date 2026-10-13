import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send, Bot, User, Trash2, AlertTriangle, Sparkles,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { chatApi, ChatMessage } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "What should I focus on today based on my pending reports?",
  "Explain how to calculate ROI for Amazon FBA products",
  "What are the best categories for online arbitrage right now?",
  "How do I handle a price war on Amazon?",
  "What are Amazon's current FBA fee structures?",
  "How do I avoid getting gated on a product?",
  "What Keepa metrics should I focus on?",
  "How do I build a replenishment strategy?",
];

export function AIChat() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = "default";

  const { data: messages, refetch } = useQuery({
    queryKey: ["chat-messages", sessionId],
    queryFn: () => chatApi.getMessages(sessionId),
  });

  const chatMessages = (messages as ChatMessage[]) || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, streamingMessage]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setStreamingMessage("");
    setIsStreaming(true);
    setError(null);

    // Optimistically add user message
    const optimisticMessages = [
      ...chatMessages,
      { id: Date.now(), role: "user", content: text, createdAt: new Date().toISOString() },
    ];

    // Show the user's message right away, while the reply streams in
    qc.setQueryData(["chat-messages", sessionId], optimisticMessages);

    let accumulated = "";

    await chatApi.sendMessage(
      text,
      sessionId,
      (chunk) => {
        accumulated += chunk;
        setStreamingMessage(accumulated);
      },
      () => {
        setIsStreaming(false);
        setStreamingMessage("");
        refetch();
      },
      (errMsg) => {
        setIsStreaming(false);
        setStreamingMessage("");
        setError(errMsg);
      }
    );
  };

  const handleClear = async () => {
    if (!confirm("Clear chat history?")) return;
    await chatApi.clearHistory(sessionId);
    refetch();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="AI Chat"
        subtitle="Claude-powered business assistant"
        actions={
          chatMessages.length > 0 ? (
            <button
              onClick={handleClear}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Quick prompts sidebar */}
        <div className="w-52 shrink-0 border-r border-border overflow-y-auto px-3 py-4">
          <p className="section-title mb-3">Quick Prompts</p>
          <div className="space-y-1">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                disabled={isStreaming}
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50 leading-relaxed"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {chatMessages.length === 0 && !streamingMessage && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                  <Sparkles className="h-8 w-8 text-accent" />
                </div>
                <p className="text-lg font-semibold text-foreground">Arbitrage Copilot</p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Your AI business assistant — ask about products, pricing, Amazon FBA strategy, accounting, and more.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  {QUICK_PROMPTS.slice(0, 4).map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(p)}
                      className="rounded-xl border border-border px-4 py-3 text-left text-xs text-muted-foreground hover:border-accent/30 hover:bg-accent/5 hover:text-foreground transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming message */}
            {streamingMessage && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <Bot className="h-4 w-4 text-accent" />
                </div>
                <div className="flex-1 rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{streamingMessage}</p>
                  <span className="inline-block h-4 w-0.5 animate-pulse bg-accent ml-0.5" />
                </div>
              </div>
            )}

            {/* Loading indicator (before first chunk) */}
            {isStreaming && !streamingMessage && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <Bot className="h-4 w-4 text-accent animate-pulse-glow" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border bg-card/50 px-6 py-4">
            <div className="flex items-end gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3 focus-within:border-accent/50 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your arbitrage business..."
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                rows={1}
                style={{ maxHeight: "120px" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-black transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Powered by Claude · Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        isUser ? "bg-secondary" : "bg-accent/10"
      )}>
        {isUser ? (
          <User className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-accent" />
        )}
      </div>
      <div className={cn("flex max-w-2xl flex-col gap-1", isUser && "items-end")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "rounded-tr-sm bg-accent/10 border border-accent/20 text-foreground"
            : "rounded-tl-sm bg-card border border-border text-foreground"
        )}>
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
