"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ContentAd from "@/components/ads/ContentAd";

interface DocumentItem {
  id: number;
  file_name: string;
  file_type: string;
}

interface Citation {
  file_name: string;
  page_number: number;
  text_snippet?: string;
}

interface Message {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence_score?: string;
  confidence_val?: number;
  complexity?: string;
  generated_queries?: string[];
  total_time?: number;
}

export default function ChatAssistant() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    setMounted(true);
    if (!accessToken) {
      router.push("/login");
    }
  }, [accessToken, router]);

  // Fetch indexed documents to let users filter search
  const { data: documents } = useQuery<DocumentItem[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/documents`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Failed to fetch documents.");
      return res.json();
    },
    enabled: !!accessToken
  });

  // Fetch chat history on load
  const { data: dbHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["chatHistory"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/chat/history`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Failed to fetch chat history.");
      const data = await res.json();
      return data.history as Message[];
    },
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (dbHistory) {
      // Map history roles
      const formatted = dbHistory.map((item: any) => ({
        id: item.id,
        role: "assistant", // Database rows are grouped by question/response pairs
        content: item.response,
        citations: item.citations,
        confidence_score: item.confidence_score,
        complexity: item.complexity,
        total_time: item.response_time + item.retrieval_time,
        // Insert user question turn before it
        userQuestion: item.question,
        timestamp: item.timestamp
      }));
      
      const flatHistory: Message[] = [];
      formatted.forEach((item) => {
        flatHistory.push({
          id: `u-${item.id}`,
          role: "user",
          content: item.userQuestion
        });
        flatHistory.push({
          id: item.id,
          role: "assistant",
          content: item.content,
          citations: item.citations,
          total_time: item.total_time
        });
      });
      setChatHistory(flatHistory);
    }
  }, [dbHistory]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, streamingText]);

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to clear your chat history?")) {
      try {
        await fetch(`${apiBase}/api/chat/history`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        setChatHistory([]);
        queryClient.invalidateQueries({ queryKey: ["chatHistory"] });
      } catch (err) {
        alert("Failed to clear chat history.");
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setQuestion("");
    setStreamingText("");
    setStreamingMessage({
      id: "streaming",
      role: "assistant",
      content: "",
    });

    try {
      const response = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          question: userMsg.content,
          file_names: selectedFiles.length > 0 ? selectedFiles : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to assistant.");
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let activeMetadata: Partial<Message> = {};

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Save the last partial line back to the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("event: ")) {
            // Event category line
            continue;
          }

          if (trimmed.startsWith("data: ")) {
            const dataRaw = trimmed.substring(6);
            try {
              const dataObj = JSON.parse(dataRaw);
              
              if (dataObj.citations) {
                // Metadata block event
                activeMetadata = {
                  citations: dataObj.citations,
                  confidence_score: dataObj.confidence_score,
                  confidence_val: dataObj.confidence_val,
                  complexity: dataObj.complexity,
                  generated_queries: dataObj.generated_queries,
                  total_time: dataObj.total_time
                };
              } else if (dataObj.text) {
                // Token event
                accumulatedText += dataObj.text;
                setStreamingText(accumulatedText);
              } else if (dataObj.chat_id) {
                // Done event
                const finalAssistantMsg: Message = {
                  id: dataObj.chat_id,
                  role: "assistant",
                  content: accumulatedText,
                  ...activeMetadata
                };
                setChatHistory((prev) => [...prev, finalAssistantMsg]);
                setStreamingMessage(null);
                setStreamingText("");
                queryClient.invalidateQueries({ queryKey: ["analytics"] });
              }
            } catch (err) {}
          }
        }
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ Error connecting to chatbot: ${err.message}`,
        },
      ]);
      setStreamingMessage(null);
    }
  };

  const toggleFileSelection = (fileName: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileName)
        ? prev.filter((name) => name !== fileName)
        : [...prev, fileName]
    );
  };

  if (!mounted || !accessToken) return null;

  return (
    <div className="flex-1 flex min-h-screen bg-slate-950 text-slate-100">
      {/* Navigation Sidebar */}
      <aside className="w-64 border-r border-slate-900 bg-slate-950 flex flex-col justify-between p-6">
        <div className="space-y-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold">
              🤖
            </div>
            <span className="font-bold text-lg text-white">KnowledgeAgent</span>
          </div>

          <nav className="space-y-1.5">
            <Link
              href="/dashboard"
              className="flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-slate-100 hover:bg-slate-900/50 rounded-xl font-medium transition-all"
            >
              <span>📊</span> <span>Dashboard</span>
            </Link>
            <Link
              href="/dashboard/upload"
              className="flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-slate-100 hover:bg-slate-900/50 rounded-xl font-medium transition-all"
            >
              <span>📁</span> <span>Upload Documents</span>
            </Link>
            <Link
              href="/dashboard/chat"
              className="flex items-center space-x-3 px-4 py-3 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl font-medium transition-all"
            >
              <span>💬</span> <span>AI Chat Assistant</span>
            </Link>
          </nav>
        </div>

        <div className="space-y-4">
          <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Signed in as</p>
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleClearHistory}
            className="w-full flex items-center justify-center space-x-2 py-3 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-sm font-semibold transition-all"
          >
            Clear History
          </button>
        </div>
      </aside>

      {/* Main Chat Assistant Frame */}
      <main className="flex-1 flex flex-col max-h-screen bg-slate-950">
        {/* Chat Header */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">AI Chat Assistant</h1>
            <p className="text-xs text-slate-400">Contextual query expansion, reranking, and citation engine.</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedFiles.length > 0
                  ? "border-indigo-500/40 text-indigo-400 bg-indigo-500/5"
                  : "border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              🔍 Filters
              {selectedFiles.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-500 text-white font-bold text-[10px] flex items-center justify-center">
                  {selectedFiles.length}
                </span>
              )}
            </button>
            
            {showFilters && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-4 z-50 space-y-3">
                <h4 className="text-xs font-bold text-white">Filter Search Context</h4>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {documents && documents.length > 0 ? (
                    documents.map((doc) => (
                      <label key={doc.id} className="flex items-center space-x-2 text-xs text-slate-350 cursor-pointer p-1 rounded hover:bg-slate-950">
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(doc.file_name)}
                          onChange={() => toggleFileSelection(doc.file_name)}
                          className="rounded border-slate-800 text-indigo-500 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                        />
                        <span className="truncate">{doc.file_name}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-[10px] text-slate-500 py-2">No documents available to filter.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {chatHistory.length === 0 && !streamingMessage ? (
            <div className="h-full flex flex-col justify-center items-center text-center space-y-4 max-w-lg mx-auto py-20">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/5">
                💬
              </div>
              <h2 className="text-lg font-bold text-slate-200">Start a conversation</h2>
              <p className="text-sm text-slate-550">
                Ask a question based on your uploaded documents. The agent will retrieve relevant passages, optimize context, and construct source-cited answers.
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-5 ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/10"
                        : "bg-slate-900 border border-slate-850/80 text-slate-200 shadow-md"
                    }`}
                  >
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80">
                        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-2">Sources Referenced</span>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map((cit, cidx) => (
                            <div
                              key={cidx}
                              title={cit.text_snippet || ""}
                              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400 flex items-center gap-1 cursor-help hover:border-slate-700 transition-colors"
                            >
                              <span>📄</span>
                              <span className="truncate max-w-[120px] font-semibold">{cit.file_name}</span>
                              <span className="text-slate-500">p.{cit.page_number}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {msg.role === "assistant" && msg.total_time && (
                      <div className="mt-2 text-[10px] text-slate-500 font-mono">
                        ⏱ Latency: {msg.total_time.toFixed(2)}s
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming placeholder */}
              {streamingMessage && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl p-5 bg-slate-900 border border-slate-850/80 text-slate-250 shadow-md space-y-2">
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {streamingText}
                      <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse ml-0.5"></span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-8 border-t border-slate-900 bg-slate-950/80 backdrop-blur max-w-4xl w-full mx-auto">
          <ContentAd />
          
          <form onSubmit={handleSend} className="relative flex items-center mt-4">
            <input
              type="text"
              required
              disabled={!!streamingMessage}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-6 py-4.5 bg-slate-900 border border-slate-850/80 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80 rounded-2xl text-slate-100 placeholder-slate-500 pr-16 shadow-inner transition-colors disabled:opacity-60"
              placeholder="Ask a question about your documents..."
            />
            <button
              type="submit"
              disabled={!question.trim() || !!streamingMessage}
              className="absolute right-3.5 p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/10 transition-all hover:scale-[1.05] active:scale-[0.95] disabled:opacity-50"
            >
              🚀
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
