import { useCallback, useEffect, useState } from "react";
import { getT, getLang, setLang, subscribe, type LangCode, type LangDict } from "./index";

export function useT(): { t: LangDict; lang: LangCode; setLang: (c: LangCode) => void } {
  const [, rerender] = useState(0);

  useEffect(() => {
    const unsub = subscribe(() => rerender((n) => n + 1));
    return () => { unsub(); };
  }, []);

  return {
    t: getT(),
    lang: getLang(),
    setLang: useCallback((code: LangCode) => setLang(code), []),
  };
}
