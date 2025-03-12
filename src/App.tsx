import SubscribedApp from "./_pages/SubscribedApp"
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient
} from "@tanstack/react-query"
import { useEffect, useState, useCallback } from "react"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from "./components/ui/toast"
import { ToastContext } from "./contexts/toast"

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 1
    }
  }
})

// Root component that provides the QueryClient
function App() {
  const [toastState, setToastState] = useState({
    open: false,
    title: "",
    description: "",
    variant: "neutral" as const
  })
  const [credits, setCredits] = useState<number>(0)
  const [currentLanguage, setCurrentLanguage] = useState<string>("python")
  const [isInitialized, setIsInitialized] = useState(false)

  // Helper function to safely update credits
  const updateCredits = useCallback((newCredits: number) => {
    setCredits(newCredits)
    window.__CREDITS__ = newCredits
  }, [])

  // Helper function to safely update language
  const updateLanguage = useCallback((newLanguage: string) => {
    setCurrentLanguage(newLanguage)
    window.__LANGUAGE__ = newLanguage
  }, [])

  // Helper function to mark initialization complete
  const markInitialized = useCallback(() => {
    setIsInitialized(true)
    window.__IS_INITIALIZED__ = true
  }, [])

  // Show toast method
  const showToast = useCallback(
    (
      title: string,
      description: string,
      variant: "neutral" | "success" | "error"
    ) => {
      setToastState({
        open: true,
        title,
        description,
        // @ts-ignore
        variant
      })
    },
    []
  )

  // Listen for PKCE code callback
  useEffect(() => {
    if (!import.meta.env.DEV) {
      const handleAuthCallbackPKCE = async (data: { code: string }) => {
        console.log("Production IPC: received code:", data)
        try {
          const { code } = data || {}
          if (!code) {
            console.error("No code in callback data")
            return
          }
        } catch (err) {
          console.error("Production PKCE: Error in auth callback:", err)
        }
      }

      console.log("PROD: Setting up PKCE-based IPC listener")
      window.electron?.ipcRenderer?.on("auth-callback", handleAuthCallbackPKCE)

      return () => {
        window.electron?.ipcRenderer?.removeListener(
          "auth-callback",
          handleAuthCallbackPKCE
        )
      }
    }
  }, [])

  // Handle credits initialization and updates
  useEffect(() => {
    const initializeAndSubscribe = async () => {

      updateCredits(100)
      markInitialized()


      // Listen for solution success to decrement credits
      const unsubscribeSolutionSuccess = window.electronAPI.onSolutionSuccess(
        async () => {
          // Wait for initialization before proceeding
          if (!isInitialized) {
            console.warn("Attempted to decrement credits before initialization")
            return
          }

          updateCredits(110)
        }
      )

      // Cleanup function
      return () => {
        // channel.unsubscribe()
        unsubscribeSolutionSuccess()

        // Reset initialization state on cleanup
        window.__IS_INITIALIZED__ = false
        setIsInitialized(false)
      }
    }

    initializeAndSubscribe()
  }, [updateCredits, updateLanguage, markInitialized, showToast, isInitialized])

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ToastContext.Provider value={{ showToast }}>
          <AppContent isInitialized={isInitialized} updateLanguage={updateLanguage} />
          <Toast
            open={toastState.open}
            onOpenChange={(open) =>
              setToastState((prev) => ({ ...prev, open }))
            }
            variant={toastState.variant}
            duration={1500}
          >
            <ToastTitle>{toastState.title}</ToastTitle>
            <ToastDescription>{toastState.description}</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

// Main App component that handles conditional rendering based on auth and subscription state
function AppContent({ isInitialized, updateLanguage }: { isInitialized: boolean, updateLanguage: (language: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [credits, setCredits] = useState<number | undefined>(undefined)
  const [currentLanguage, setCurrentLanguage] = useState<string>("java")
  const queryClient = useQueryClient()

  // Check auth state on mount
  useEffect(() => {
    // First check if we have an existing session
    const checkExistingSession = async () => {

      setLoading(false)
    }

    checkExistingSession()

    return () => {
      // Clear the token on cleanup
      window.__AUTH_TOKEN__ = null
    }
  }, [])

  // Check subscription and credits status whenever user changes
  useEffect(() => {
    const checkSubscriptionAndCredits = async () => {
      setSubscriptionLoading(true)
      setCredits(100)
      setSubscriptionLoading(false)
      setLoading(false)
    }

    checkSubscriptionAndCredits()
  }, [queryClient])

  useEffect(() => {
    updateLanguage(currentLanguage)
  }, [currentLanguage])
  // Show loading state while checking auth, subscription, initialization, or credits
  if (
    loading ||
    subscriptionLoading || !isInitialized || credits === undefined
  ) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
          <p className="text-white/60 text-sm">
            {loading
              ? "Loading..."
              : !isInitialized
                ? "Initializing...If you see this screen for more than 10 seconds, please quit and restart the app."
                : credits === undefined
                  ? "Loading credits..."
                  : "Checking subscription..."}
          </p>
        </div>
      </div>
    )
  }

  // If logged in and subscribed with credits loaded, show the app
  return (
    <SubscribedApp
      credits={credits!}
      currentLanguage={currentLanguage}
      setLanguage={setCurrentLanguage}
    />
  )
}

export default App
