"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, Link as LinkIcon, Play, List, BookOpen } from "lucide-react";
import MicButton from "@/components/MicButton";

interface ArticlePreview {
  headline: string;
  source: string;
  time: string;
  entities: string[];
}

const SUGGESTIONS = [
  { icon: Play, label: "Walk me through this article" },
  { icon: List, label: "Summarize the key points" },
  { icon: BookOpen, label: "Explain the background" },
];

// Demo article for placeholder
const DEMO_ARTICLE: ArticlePreview = {
  headline: "ECB Signals Further Rate Cuts as Eurozone Inflation Slows",
  source: "Reuters",
  time: "2 hours ago",
  entities: ["ECB", "Christine Lagarde", "Eurozone", "Inflation"],
};

export default function ArticleModeScreen() {
  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<ArticlePreview | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      // Placeholder: show demo article
      setArticle(DEMO_ARTICLE);
    }
  };

  return (
    <div className="flex flex-col h-screen relative" style={{ backgroundColor: "#FFFAEB" }}>
      {/* Top bar */}
      <header className="z-10 flex items-center px-5 py-4 border-b border-[#E9E2CB]" style={{ backgroundColor: "#FFFAEB" }}>
        <Link href="/" className="p-1 rounded-lg hover:bg-[#FFF0C3] transition-colors">
          <ArrowLeft size={20} className="text-dark" />
        </Link>
        <h1 className="flex-1 text-center font-bold text-base text-dark">Article Mode</h1>
        <button className="p-1 rounded-lg hover:bg-[#FFF0C3] transition-colors">
          <Share2 size={20} className="text-dark" />
        </button>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8 pb-32" style={{ scrollbarWidth: "none" }}>
        {/* URL Input */}
        <form onSubmit={handleSubmit}>
          <div className="flex items-center bg-[#FFF0C3] border-2 border-[#E9E2CB] rounded-lg focus-within:border-[#FF8205] transition-colors">
            <div className="pl-4">
              <LinkIcon size={16} style={{ color: "#1E1E1E", opacity: 0.4 }} />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste an article URL..."
              className="flex-1 bg-transparent px-3 py-3 text-sm text-dark placeholder:text-dark-tinted/40 outline-none"
            />
            {url && (
              <button
                type="submit"
                className="px-5 py-3 bg-[#FF8205] hover:bg-[#FA500F] text-white text-sm font-semibold rounded-r-lg transition-colors"
              >
                Go
              </button>
            )}
          </div>
        </form>

        {/* Article Preview */}
        {article && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#FFF0C3] border border-[#E9E2CB] rounded-xl p-4 shadow-sm space-y-3"
          >
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="font-bold text-dark leading-tight line-clamp-2">
                  {article.headline}
                </p>
                <p className="text-xs font-medium mt-1" style={{ color: "#1E1E1E", opacity: 0.6 }}>
                  {article.source} · {article.time}
                </p>
              </div>
              <div className="w-16 h-16 rounded-lg bg-[#E9E2CB] flex-shrink-0" />
            </div>

            {/* Entity chips */}
            <div className="flex flex-wrap gap-2">
              {article.entities.map((entity) => (
                <span
                  key={entity}
                  className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-md border"
                  style={{
                    borderColor: "rgba(0,0,0,0.1)",
                    backgroundColor: "#FFFAEB",
                    color: "#1E1E1E",
                  }}
                >
                  {entity}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* AI Prompt Suggestions */}
        {article && (
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider ml-1"
              style={{ color: "#1E1E1E", opacity: 0.4 }}
            >
              Ask about this article
            </h3>
            {SUGGESTIONS.map((suggestion, i) => (
              <motion.button
                key={suggestion.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="w-full bg-[#FFF0C3] rounded-xl p-4 border-l-[3px] border-[#FF8205]
                  flex items-center gap-3 hover:bg-[#FFE5A0] active:scale-[0.99] transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-[#FFFAEB] flex items-center justify-center group-hover:bg-[#FF8205] transition-colors">
                  <suggestion.icon
                    size={16}
                    className="text-[#FF8205] group-hover:text-white transition-colors"
                  />
                </div>
                <span className="text-sm font-medium text-dark">{suggestion.label}</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Mic button */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="pointer-events-auto">
          <MicButton
            state="idle"
            onPressStart={() => {}}
            onPressEnd={() => {}}
            size="md"
            label="Tap to ask about this article"
          />
        </div>
      </div>
    </div>
  );
}
