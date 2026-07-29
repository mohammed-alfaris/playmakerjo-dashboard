import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

// This fallback must be structurally incapable of throwing. It deliberately does
// NOT call useT(): the boundary sits above LanguageProvider so that a crash in
// the provider itself is still caught, and reading a React context that is not
// mounted throws — which would take out the whole tree with no boundary above to
// catch it (a blank white page instead of this screen). Hence the inline copy and
// the plain <button>: no context, no hooks, no imported components.
const FALLBACK_COPY = {
  en: {
    title: "Something went wrong",
    body: "The page failed to load. Reloading usually fixes it. If it keeps happening, please get in touch.",
    reload: "Reload",
  },
  ar: {
    title: "صار في خطأ",
    body: "الصفحة ما قدرت تفتح. عادةً إعادة التحميل بتحل المشكلة. إذا تكرر الأمر، تواصل معنا.",
    reload: "إعادة تحميل",
  },
} as const

function FallbackUI() {
  let lang: "en" | "ar" = "en"
  try {
    if (localStorage.getItem("lang") === "ar") lang = "ar"
  } catch {
    // localStorage can throw in private mode / sandboxed frames — English it is.
  }
  const copy = FALLBACK_COPY[lang]

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <h1 className="text-2xl font-semibold">{copy.title}</h1>
      <p className="max-w-md text-muted-foreground">{copy.body}</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {copy.reload}
      </button>
    </div>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) return <FallbackUI />
    return this.props.children
  }
}
