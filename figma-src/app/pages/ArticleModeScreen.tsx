import { ArrowLeft, Share, Link as LinkIcon, ExternalLink, Play, List, Book } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";

export function ArticleModeScreen() {
  const [url, setUrl] = useState("");
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) setIsPreviewVisible(true);
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#FFFAEB] relative">
      {/* Top Bar */}
      <div className="flex justify-between items-center px-5 py-4 z-10 border-b border-[#E9E2CB]">
        <Link to="/" className="p-2 -ml-2 text-[#000000] hover:bg-[#FFF0C3] rounded-full transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-base font-bold text-[#000000]">Article Mode</h1>
        <button className="p-2 -mr-2 text-[#000000] hover:bg-[#FFF0C3] rounded-full transition-colors">
          <Share size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8 [&::-webkit-scrollbar]:hidden pb-32">
        {/* URL Input */}
        <form onSubmit={handleSubmit} className="relative group">
          <div className="flex items-center bg-[#FFF0C3] border-2 border-[#E9E2CB] rounded-lg overflow-hidden focus-within:border-[#FF8205] transition-colors">
            <LinkIcon size={16} className="ml-4 text-[#1E1E1E] opacity-40" />
            <input
              type="url"
              placeholder="Paste an article URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-3 py-3 bg-transparent outline-none text-sm placeholder:text-[#1E1E1E]/40"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-[#FF8205] text-white font-medium text-sm hover:bg-[#FA500F] transition-colors"
            >
              Go
            </button>
          </div>
        </form>

        {/* Article Preview Card (Conditional) */}
        {isPreviewVisible && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#FFF0C3] rounded-xl p-4 shadow-sm border border-[#E9E2CB] space-y-3"
          >
            <div className="flex gap-4 items-start">
              <div className="flex-1 space-y-1">
                <h3 className="font-bold text-[#000000] leading-tight line-clamp-2">
                  ECB Signals Rate Pause as Inflation Fears Persist
                </h3>
                <p className="text-xs text-[#1E1E1E] opacity-60 font-medium">
                  BBC News · 2 hours ago
                </p>
              </div>
              <div className="w-16 h-16 rounded-lg bg-[#E9E2CB] shrink-0 overflow-hidden">
                 <img 
                   src="https://images.unsplash.com/photo-1611974765270-ca1258634369?q=80&w=200&auto=format&fit=crop" 
                   alt="Article Thumbnail" 
                   className="w-full h-full object-cover"
                 />
              </div>
            </div>

            {/* Entity Chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              {["ECB", "Christine Lagarde", "Eurozone", "Inflation"].map((chip) => (
                <span
                  key={chip}
                  className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide border border-[#000000]/10 rounded-md bg-[#FFFAEB] text-[#1E1E1E]"
                >
                  {chip}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* AI Prompt Suggestions */}
        {isPreviewVisible && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[#1E1E1E] uppercase tracking-wider opacity-40 ml-1">
              Suggestions
            </p>
            {[{ icon: Play, label: "Walk me through this article" },
              { icon: List, label: "Summarize the key points" },
              { icon: Book, label: "Explain the background" },
            ].map((suggestion, i) => {
              const Icon = suggestion.icon;
              return (
                <motion.button
                  key={suggestion.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="w-full flex items-center gap-3 p-4 bg-[#FFF0C3] rounded-xl border-l-[3px] border-[#FF8205] hover:bg-[#FFE5A0] active:scale-[0.99] transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-full bg-[#FFFAEB] flex items-center justify-center text-[#FF8205] group-hover:bg-[#FF8205] group-hover:text-white transition-colors">
                    <Icon size={14} fill="currentColor" />
                  </div>
                  <span className="font-medium text-sm text-[#000000]">{suggestion.label}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mic Button Area */}
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <button className="w-16 h-16 rounded-full bg-[#FF8205] text-white flex items-center justify-center shadow-lg shadow-orange-500/20 active:scale-95 transition-all duration-200 hover:bg-[#FA500F]">
            <span className="sr-only">Speak</span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
        </div>
        <p className="mt-4 text-[10px] font-medium text-[#1E1E1E] opacity-40 uppercase tracking-wide">
          Tap to ask about this article
        </p>
      </div>
    </div>
  );
}
