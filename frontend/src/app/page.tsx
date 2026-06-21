import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="font-bold text-white text-lg">🤖</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-indigo-200">
              KnowledgeAgent <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">SaaS</span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center py-20 lg:py-32">
        <div className="text-center space-y-8 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-indigo-400 font-medium">
            <span>✨ Now Powered by Gemini 2.5 Flash & LangGraph</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-slate-400">
            Chat with your documents, <br className="hidden sm:inline" />
            backed by agentic AI.
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
            Upload PDFs, DOCX, PPTX, and TXT files. Query them securely with isolated user environments, source citations, and self-correcting agent validation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl shadow-xl shadow-indigo-500/20 font-medium transition-all hover:scale-[1.02] active:scale-[0.98] text-center"
            >
              Create Free Account
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 rounded-xl font-medium transition-colors text-center"
            >
              Sign In to Console
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 lg:mt-32">
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-8 hover:border-slate-700/80 transition-all hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-semibold mb-6">
              🔒
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Isolated Tenancy</h3>
            <p className="text-slate-400 font-light">
              Complete document, vector database, and chat history isolation. Your data is strictly yours.
            </p>
          </div>
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-8 hover:border-slate-700/80 transition-all hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-semibold mb-6">
              🧠
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Agentic Workflow</h3>
            <p className="text-slate-400 font-light">
              LangGraph coordinates Query Understanding, Retrieval, Context Optimization, and Validation.
            </p>
          </div>
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-8 hover:border-slate-700/80 transition-all hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-semibold mb-6">
              📊
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Detailed Analytics</h3>
            <p className="text-slate-400 font-light">
              Track token usage, latencies, cost, and collection chunk counts in real-time.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-black/40 py-8 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} KnowledgeAgent SaaS. All rights reserved.</p>
      </footer>
    </div>
  );
}
