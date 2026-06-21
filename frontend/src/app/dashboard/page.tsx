"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import BannerAd from "@/components/ads/BannerAd";
import SidebarAd from "@/components/ads/SidebarAd";

interface DocumentItem {
  id: number;
  file_name: string;
  file_type: string;
  upload_date: string;
  chunk_count: number;
}

interface AnalyticsData {
  queries_asked: number;
  total_tokens_used: number;
  average_latency: number;
  documents_indexed: number;
  chunks_created: number;
  total_storage_bytes: number;
  estimated_cost_usd: number;
  latency_trend: {
    id: number;
    question: string;
    timestamp: string;
    retrieval_time: number;
    response_time: number;
    total_time: number;
  }[];
  documents_list: DocumentItem[];
}

export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, user, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!accessToken) {
      router.push("/login");
    }
  }, [accessToken, router]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Fetch Analytics & Documents using React Query
  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/analytics`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Failed to fetch analytics.");
      return res.json();
    },
    enabled: !!accessToken
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await fetch(`${apiBase}/api/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Failed to delete document.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    }
  });

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!mounted || !accessToken || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-950 text-slate-400">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto"></div>
          <p className="text-sm">Loading workspace dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar navigation */}
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
              className="flex items-center space-x-3 px-4 py-3 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl font-medium transition-all"
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
              className="flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-slate-100 hover:bg-slate-900/50 rounded-xl font-medium transition-all"
            >
              <span>💬</span> <span>AI Chat Assistant</span>
            </Link>
          </nav>

          <SidebarAd />
        </div>

        <div className="space-y-4">
          <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Signed in as</p>
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-3 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 rounded-xl text-sm font-semibold transition-all"
          >
            <span>🚪</span> <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main dashboard content */}
      <main className="flex-1 flex flex-col p-8 overflow-y-auto max-h-screen">
        <div className="max-w-6xl w-full mx-auto space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-white">System Dashboard</h1>
              <p className="text-sm text-slate-400">Isolated workspace and pipeline telemetry statistics.</p>
            </div>
            <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
              Session ID: <span className="font-mono text-indigo-400">user_{user?.id}</span>
            </div>
          </div>

          <BannerAd />

          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 text-4xl opacity-15">📁</div>
              <p className="text-sm text-slate-500 font-medium">Documents Indexed</p>
              <p className="text-3xl font-extrabold text-white mt-2">{analytics?.documents_indexed || 0}</p>
              <div className="text-xs text-indigo-400 mt-2 font-mono">{analytics?.chunks_created || 0} chunks total</div>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 text-4xl opacity-15">💬</div>
              <p className="text-sm text-slate-500 font-medium">Total Queries</p>
              <p className="text-3xl font-extrabold text-white mt-2">{analytics?.queries_asked || 0}</p>
              <div className="text-xs text-slate-400 mt-2">Average: {analytics?.average_latency ? `${analytics.average_latency.toFixed(2)}s` : "0.00s"}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 text-4xl opacity-15">⚡</div>
              <p className="text-sm text-slate-500 font-medium">Estimated Storage</p>
              <p className="text-3xl font-extrabold text-white mt-2">
                {formatBytes(analytics?.total_storage_bytes || 0)}
              </p>
              <div className="text-xs text-slate-400 mt-2">Chroma DB persistent storage</div>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 text-4xl opacity-15">💵</div>
              <p className="text-sm text-slate-500 font-medium">Projected Cost</p>
              <p className="text-3xl font-extrabold text-white mt-2">
                ${analytics?.estimated_cost_usd ? analytics.estimated_cost_usd.toFixed(5) : "0.00000"}
              </p>
              <div className="text-xs text-emerald-400 mt-2 font-mono">{analytics?.total_tokens_used || 0} tokens used</div>
            </div>
          </div>

          {/* Latency Trend chart */}
          <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Pipeline Latency Trend (Seconds)</h3>
            <div className="h-64">
              {analytics && analytics.latency_trend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.latency_trend}>
                    <defs>
                      <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="id" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_time"
                      name="Total Latency"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#latencyGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="retrieval_time"
                      name="DB Retrieval"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      fillOpacity={0}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  Run some queries in the AI chat assistant to generate latency analytics.
                </div>
              )}
            </div>
          </div>

          {/* Document list */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-850 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Indexed Knowledge Documents</h3>
              <Link
                href="/dashboard/upload"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-500/10 transition-colors"
              >
                + Add Files
              </Link>
            </div>
            {analytics?.documents_list && analytics.documents_list.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-500 text-xs font-semibold tracking-wider border-b border-slate-850">
                      <th className="px-6 py-4">Filename</th>
                      <th className="px-6 py-4">File Type</th>
                      <th className="px-6 py-4">Upload Date</th>
                      <th className="px-6 py-4">Chunks Created</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300 text-sm">
                    {analytics.documents_list.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-200">{doc.file_name}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 text-xs border border-slate-800">
                            {doc.file_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {new Date(doc.upload_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400">{doc.chunk_count}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${doc.file_name}?`)) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="px-2.5 py-1 text-rose-500 hover:text-white border border-rose-500/20 hover:bg-rose-600 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-sm space-y-2">
                <p>No documents uploaded yet.</p>
                <Link href="/dashboard/upload" className="text-indigo-400 hover:text-indigo-300 underline font-medium">
                  Go upload files to feed the knowledge base.
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
