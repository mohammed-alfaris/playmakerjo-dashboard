import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/LanguageContext"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

function FallbackUI() {
  const { t } = useT()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-display font-semibold">{t("error_boundary_title")}</h1>
      <p className="text-muted-foreground max-w-md">{t("error_boundary_body")}</p>
      <Button onClick={() => window.location.reload()}>{t("error_boundary_reload")}</Button>
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
