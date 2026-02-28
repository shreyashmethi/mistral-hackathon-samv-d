import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { clsx } from "clsx";
import * as Switch from "@radix-ui/react-switch";
import * as Slider from "@radix-ui/react-slider";

export function SettingsScreen() {
  const [briefingLength, setBriefingLength] = useState("Medium");
  const [speechSpeed, setSpeechSpeed] = useState(50);
  const [autoListen, setAutoListen] = useState(true);

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFAEB] relative pb-8">
      {/* Top Bar */}
      <div className="flex items-center px-5 py-4 border-b border-[#E9E2CB] sticky top-0 bg-[#FFFAEB] z-10">
        <Link to="/" className="p-2 -ml-2 text-[#000000] hover:bg-[#FFF0C3] rounded-full transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-[#000000] -ml-8">Settings</h1>
      </div>

      <div className="px-5 py-6 space-y-8">
        {/* Profile Section */}
        <div className="flex items-center gap-4 bg-[#FFF0C3] p-4 rounded-xl border border-[#E9E2CB]">
          <div className="w-16 h-16 rounded-full bg-[#E9E2CB] flex items-center justify-center text-xl font-bold text-[#1E1E1E]/40 overflow-hidden">
            <img 
               src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=200&auto=format&fit=crop" 
               alt="Devashish" 
               className="w-full h-full object-cover"
             />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-[#000000]">Devashish</h2>
            <p className="text-xs text-[#1E1E1E] opacity-60">devashish@example.com</p>
          </div>
          <button className="text-sm font-semibold text-[#FF8205] hover:text-[#FA500F]">
            Edit
          </button>
        </div>

        {/* Section: News Preferences */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-[#1E1E1E] opacity-40 uppercase tracking-widest pl-1">
            News Preferences
          </h3>
          <div className="space-y-1">
            <SettingRow label="Topics" value="Tech, Europe, Science" hasChevron />
            <SettingRow label="Sources" value="6 sources" hasChevron />
            
            {/* Briefing Length Segmented Control */}
            <div className="py-4 border-b border-[#E9E2CB]">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-[#000000]">Briefing Length</span>
              </div>
              <div className="flex p-1 bg-[#E9E2CB]/30 rounded-xl">
                {["Short", "Medium", "Detailed"].map((option) => (
                  <button
                    key={option}
                    onClick={() => setBriefingLength(option)}
                    className={clsx(
                      "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                      briefingLength === option
                        ? "bg-[#FF8205] text-white shadow-sm"
                        : "text-[#1E1E1E] hover:bg-[#E9E2CB]/50"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section: Voice */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-[#1E1E1E] opacity-40 uppercase tracking-widest pl-1">
            Voice
          </h3>
          <div className="space-y-1">
            <SettingRow label="AI Voice" value="Aria" hasChevron />
            
            {/* Speech Speed Slider */}
            <div className="py-4 border-b border-[#E9E2CB]">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-[#000000]">Speech Speed</span>
              </div>
              <Slider.Root
                className="relative flex items-center select-none touch-none w-full h-5"
                value={[speechSpeed]}
                onValueChange={(val) => setSpeechSpeed(val[0])}
                max={100}
                step={1}
              >
                <Slider.Track className="bg-[#E9E2CB] relative grow rounded-full h-[3px]">
                  <Slider.Range className="absolute bg-[#FF8205] rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb
                  className="block w-5 h-5 bg-[#FF8205] shadow-md rounded-full hover:bg-[#FA500F] focus:outline-none focus:ring-2 focus:ring-[#FF8205]/20"
                  aria-label="Speech Speed"
                />
              </Slider.Root>
              <div className="flex justify-between mt-2 px-1">
                <span className="text-[10px] font-medium text-[#1E1E1E]/40 uppercase">Slow</span>
                <span className="text-[10px] font-medium text-[#1E1E1E]/40 uppercase">Fast</span>
              </div>
            </div>

            {/* Auto-listen Switch */}
            <div className="py-4 border-b border-[#E9E2CB] flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-[#000000] mb-1">Auto-listen</div>
                <p className="text-xs text-[#1E1E1E] opacity-60 leading-relaxed">
                  Start listening automatically after AI finishes speaking
                </p>
              </div>
              <Switch.Root
                checked={autoListen}
                onCheckedChange={setAutoListen}
                className={clsx(
                  "w-11 h-7 rounded-full relative transition-colors border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF8205]/20",
                  autoListen ? "bg-[#FF8205]" : "bg-[#E9E2CB]"
                )}
              >
                <Switch.Thumb
                  className={clsx(
                    "block w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-100 translate-x-0.5 will-change-transform",
                    autoListen ? "translate-x-[18px]" : "translate-x-0"
                  )}
                />
              </Switch.Root>
            </div>
          </div>
        </section>

        {/* Section: About */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-[#1E1E1E] opacity-40 uppercase tracking-widest pl-1">
            About
          </h3>
          <div className="space-y-1">
            <SettingRow label="How Samvād Works" hasChevron />
            <SettingRow label="Send Feedback" hasChevron />
          </div>
        </section>

        <p className="text-center text-[10px] font-medium text-[#1E1E1E]/30 pt-4">
          Version 1.0.0 (Hackathon)
        </p>
      </div>
    </div>
  );
}

function SettingRow({ label, value, hasChevron }: { label: string; value?: string; hasChevron?: boolean }) {
  return (
    <button className="w-full flex justify-between items-center py-4 border-b border-[#E9E2CB] group active:bg-[#E9E2CB]/20 transition-colors -mx-2 px-2 rounded-lg">
      <span className="text-sm font-medium text-[#000000]">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-[#FF8205] font-medium">{value}</span>}
        {hasChevron && <ChevronRight size={16} className="text-[#1E1E1E]/40" />}
      </div>
    </button>
  );
}
