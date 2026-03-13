import { useT } from "@/i18n/useT";
import { LANGUAGES, type LangCode } from "@/i18n/index";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const LANG_ORDER: LangCode[] = ["es", "en", "pt", "fr"];

export function LanguageSelector() {
  const { t, lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative z-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all"
        aria-label="Cambiar idioma"
      >
        <span className="text-base">{t.flag}</span>
        <span className="hidden sm:inline text-xs font-bold tracking-wide uppercase opacity-70">
          {lang.toUpperCase()}
        </span>
        <ChevronDown
          className={`w-3 h-3 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 min-w-[140px] rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: "hsl(222 47% 13%)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {LANG_ORDER.map((code) => {
            const l = LANGUAGES[code];
            const active = code === lang;
            return (
              <button
                key={code}
                onClick={() => { setLang(code); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/10"
                style={{ color: active ? "#f9a825" : "rgba(255,255,255,0.85)" }}
              >
                <span className="text-lg">{l.flag}</span>
                <span className="font-semibold">{l.lang}</span>
                {active && (
                  <span className="ml-auto text-[10px] font-black tracking-widest text-[#f9a825] opacity-80">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
