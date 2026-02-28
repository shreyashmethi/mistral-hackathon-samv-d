"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

const BRIEFING_OPTIONS = ["Short", "Medium", "Detailed"] as const;

export default function SettingsScreen() {
  const [briefingLength, setBriefingLength] = useState<string>("Medium");
  const [speechSpeed, setSpeechSpeed] = useState(50);
  const [autoListen, setAutoListen] = useState(false);

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#FFFAEB" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center px-5 py-4 border-b border-[#E9E2CB]" style={{ backgroundColor: "#FFFAEB" }}>
        <Link href="/" className="p-1 rounded-lg hover:bg-[#FFF0C3] transition-colors">
          <ArrowLeft size={20} className="text-dark" />
        </Link>
        <h1 className="flex-1 text-center font-bold text-base text-dark -ml-8">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8" style={{ scrollbarWidth: "none" }}>
        {/* Profile section */}
        <div className="bg-[#FFF0C3] border border-[#E9E2CB] rounded-xl p-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#E9E2CB] flex items-center justify-center text-2xl font-bold text-dark-tinted/40">
            S
          </div>
          <div className="flex-1">
            <p className="font-bold text-dark">Samvād User</p>
            <p className="text-xs" style={{ color: "#1E1E1E", opacity: 0.6 }}>user@samvad.app</p>
          </div>
          <button className="text-sm font-semibold text-[#FF8205] hover:text-[#FA500F] transition-colors">
            Edit
          </button>
        </div>

        {/* News Preferences */}
        <section>
          <SectionHeader>News Preferences</SectionHeader>
          <SettingRow label="Topics" value="Tech, Europe, Science" />
          <SettingRow label="Sources" value="6 sources" />

          {/* Briefing Length */}
          <div className="py-4 border-b border-[#E9E2CB]">
            <p className="text-sm font-medium text-dark mb-3">Briefing Length</p>
            <div className="p-1 rounded-xl" style={{ backgroundColor: "rgba(233, 226, 203, 0.3)" }}>
              <div className="flex">
                {BRIEFING_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setBriefingLength(opt)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      briefingLength === opt
                        ? "bg-[#FF8205] text-white shadow-sm"
                        : "text-[#1E1E1E] hover:bg-[#E9E2CB]/50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Voice */}
        <section>
          <SectionHeader>Voice</SectionHeader>
          <SettingRow label="AI Voice" value="Aria" />

          {/* Speech Speed */}
          <div className="py-4 border-b border-[#E9E2CB]">
            <p className="text-sm font-medium text-dark mb-3">Speech Speed</p>
            <input
              type="range"
              min={0}
              max={100}
              value={speechSpeed}
              onChange={(e) => setSpeechSpeed(Number(e.target.value))}
              className="w-full h-[3px] rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #FF8205 ${speechSpeed}%, #E9E2CB ${speechSpeed}%)`,
              }}
            />
            <div className="flex justify-between mt-2">
              <span className="text-[10px] font-medium uppercase" style={{ color: "#1E1E1E", opacity: 0.4 }}>Slow</span>
              <span className="text-[10px] font-medium uppercase" style={{ color: "#1E1E1E", opacity: 0.4 }}>Fast</span>
            </div>
          </div>

          {/* Auto-listen toggle */}
          <div className="py-4 border-b border-[#E9E2CB] flex justify-between items-start gap-4">
            <div>
              <p className="text-sm font-medium text-dark mb-1">Auto-listen</p>
              <p className="text-xs leading-relaxed" style={{ color: "#1E1E1E", opacity: 0.6 }}>
                Automatically start listening after the AI finishes speaking
              </p>
            </div>
            <button
              onClick={() => setAutoListen(!autoListen)}
              className={`relative flex-shrink-0 w-11 h-7 rounded-full transition-colors ${
                autoListen ? "bg-[#FF8205]" : "bg-[#E9E2CB]"
              }`}
              aria-label="Toggle auto-listen"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${
                  autoListen ? "translate-x-[18px]" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>

        {/* About */}
        <section>
          <SectionHeader>About</SectionHeader>
          <SettingRow label="How Samvād Works" />
          <SettingRow label="Send Feedback" />
        </section>

        {/* Version */}
        <p className="text-center pt-4 text-[10px] font-medium" style={{ color: "#1E1E1E", opacity: 0.3 }}>
          Version 1.0.0 (Hackathon)
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-bold uppercase tracking-widest pl-1 mb-2"
      style={{ color: "#1E1E1E", opacity: 0.4 }}
    >
      {children}
    </h2>
  );
}

function SettingRow({ label, value }: { label: string; value?: string }) {
  return (
    <button className="w-full py-4 px-2 -mx-2 border-b border-[#E9E2CB] flex justify-between items-center rounded-lg hover:bg-[#E9E2CB]/20 active:bg-[#E9E2CB]/20 transition-colors">
      <span className="text-sm font-medium text-dark">{label}</span>
      <div className="flex items-center gap-1">
        {value && (
          <span className="text-sm font-medium text-[#FF8205]">{value}</span>
        )}
        <ChevronRight size={16} style={{ color: "#1E1E1E", opacity: 0.4 }} />
      </div>
    </button>
  );
}
