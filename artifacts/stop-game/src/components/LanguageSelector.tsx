import { useT } from "@/i18n/useT";
import { LANGUAGES, type LangCode } from "@/i18n/index";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

const LANG_ORDER: LangCode[] = ["es", "en", "pt", "fr"];

export function LanguageSelector() {
  const { t, lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Position of the dropdown in viewport coords. We render the dropdown via a
  // portal anchored to <body> so it can't be clipped/stacked under the giant
  // STOP logo card (which sits in a sibling stacking context in <main>).
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current && ref.current.contains(target)) return;
      // Also ignore clicks inside the portalled menu (it lives outside `ref`).
      if (target instanceof Element && target.closest("[data-language-menu]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
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

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          data-language-menu
          className="fixed min-w-[140px] rounded-2xl shadow-2xl overflow-hidden"
          style={{
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
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
        </div>,
        document.body
      )}
    </div>
  );
}
