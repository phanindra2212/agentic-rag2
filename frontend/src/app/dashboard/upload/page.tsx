"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import BannerAd from "@/components/ads/BannerAd";

interface UploadProgress {
  name: string;
  size: number;
  status: "idle" | "uploading" | "success" | "error";
  progress: number;
  errorMsg?: string;
}

export default function DocumentUpload() {
  const router = useRouter();
  const { accessToken, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [uploadingAll, setUploadingAll] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!accessToken) {
      router.push("/login");
    }
  }, [accessToken, router]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const validateFile = (file: File): string | null => {
    const supportedExtensions = [".pdf", ".docx", ".pptx", ".txt"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!supportedExtensions.includes(ext)) {
      return `Format not supported. Types: ${supportedExtensions.join(", ")}`;
    }
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return "File size exceeds 50MB limit.";
    }
    return null;
  };

  const addFiles = (fileList: FileList) => {
    const newUploads: UploadProgress[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const errorMsg = validateFile(file);
      newUploads.push({
        name: file.name,
        size: file.size,
        status: errorMsg ? "error" : "idle",
        progress: 0,
        errorMsg: errorMsg || undefined,
      });

      // If valid, start upload
      if (!errorMsg) {
        uploadSingleFile(file);
      }
    }
    setUploads((prev) => [...prev, ...newUploads]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFiles(e.target.files);
    }
  };

  const uploadSingleFile = (file: File) => {
    const formData = new FormData();
    formData.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBase}/api/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

    // Update state to uploading
    setUploads((prev) =>
      prev.map((up) =>
        up.name === file.name ? { ...up, status: "uploading", progress: 0 } : up
      )
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploads((prev) =>
          prev.map((up) =>
            up.name === file.name ? { ...up, progress: percentComplete } : up
          )
        );
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        setUploads((prev) =>
          prev.map((up) =>
            up.name === file.name ? { ...up, status: "success", progress: 100 } : up
          )
        );
      } else {
        let errText = "Upload failed.";
        try {
          const resJson = JSON.parse(xhr.responseText);
          errText = resJson.detail || errText;
        } catch {}
        setUploads((prev) =>
          prev.map((up) =>
            up.name === file.name
              ? { ...up, status: "error", errorMsg: errText }
              : up
          )
        );
      }
    };

    xhr.onerror = () => {
      setUploads((prev) =>
        prev.map((up) =>
          up.name === file.name
            ? { ...up, status: "error", errorMsg: "Network connection error." }
            : up
        )
      );
    };

    xhr.send(formData);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
              className="flex items-center space-x-3 px-4 py-3 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl font-medium transition-all"
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
        </div>

        <div className="space-y-4">
          <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Signed in as</p>
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center space-x-2 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 rounded-xl text-sm font-semibold transition-all"
          >
            <span>🏠</span> <span>Back to Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* Main View Area */}
      <main className="flex-1 flex flex-col p-8 overflow-y-auto max-h-screen">
        <div className="max-w-4xl w-full mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Upload Knowledge Documents</h1>
            <p className="text-sm text-slate-400">Feed the multi-document RAG assistant. File size limit is 50MB.</p>
          </div>

          <BannerAd />

          {/* Drag & Drop Box */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragActive
                ? "border-indigo-500 bg-indigo-500/5"
                : "border-slate-800 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900/50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInput}
              multiple
              accept=".pdf,.docx,.pptx,.txt"
              className="hidden"
            />
            <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-center text-3xl mb-6 shadow-md">
              📁
            </div>
            <p className="text-lg font-bold text-slate-250 mb-1">
              Drag & Drop your files here
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Or click to browse from device.
            </p>
            <div className="inline-flex gap-2">
              <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-850 text-xs text-slate-400">PDF</span>
              <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-850 text-xs text-slate-400">DOCX</span>
              <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-850 text-xs text-slate-400">PPTX</span>
              <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-850 text-xs text-slate-400">TXT</span>
            </div>
          </div>

          {/* Upload progress checklist */}
          {uploads.length > 0 && (
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white mb-2">Upload Progress</h3>
              <div className="space-y-4">
                {uploads.map((file, idx) => (
                  <div key={idx} className="flex flex-col space-y-2 border-b border-slate-850/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">
                          {file.status === "success" && "✅"}
                          {file.status === "error" && "❌"}
                          {file.status === "uploading" && "⏳"}
                          {file.status === "idle" && "💤"}
                        </span>
                        <span className="font-semibold text-slate-200 truncate max-w-sm sm:max-w-md">{file.name}</span>
                        <span className="text-xs text-slate-500">({formatBytes(file.size)})</span>
                      </div>
                      <div>
                        {file.status === "uploading" && (
                          <span className="text-xs text-indigo-400 font-mono font-bold">{file.progress}%</span>
                        )}
                        {file.status === "success" && (
                          <span className="text-xs text-emerald-400 font-bold">Processed</span>
                        )}
                        {file.status === "error" && (
                          <span className="text-xs text-rose-400 font-bold">Failed</span>
                        )}
                      </div>
                    </div>

                    {file.status === "uploading" && (
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-900">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-150"
                          style={{ width: `${file.progress}%` }}
                        ></div>
                      </div>
                    )}

                    {file.status === "error" && file.errorMsg && (
                      <p className="text-xs text-rose-500 pl-6">{file.errorMsg}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
