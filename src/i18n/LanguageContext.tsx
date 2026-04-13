import { createContext, useContext, useState, useEffect } from "react"
import { translations, type Lang, type TranslationKey } from "./translations"

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    (localStorage.getItem("lang") as Lang) ?? "en"
  )

  function applyLang(l: Lang) {
    document.documentElement.setAttribute("dir", l === "ar" ? "rtl" : "ltr")
    document.documentElement.setAttribute("lang", l === "ar" ? "ar" : "en")
  }

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem("lang", l)
    applyLang(l)
  }

  // Apply on first render (before any React paint)
  useEffect(() => {
    applyLang(lang)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function t(key: TranslationKey): string {
    const dict = translations[lang] as Record<string, string>
    const fallback = translations.en as Record<string, string>
    return dict[key] ?? fallback[key] ?? key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useT() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useT must be used inside LanguageProvider")
  return ctx
}
