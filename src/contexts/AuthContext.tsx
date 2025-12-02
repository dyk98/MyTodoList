import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getCurrentUser, logout as apiLogout, type User } from '@/utils/api'

interface AuthContextType {
  user: User | null
  loading: boolean
  isDemo: boolean
  refreshUser: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    apiLogout()
    setUser(null)
    // 刷新页面以重新加载 demo 数据
    window.location.reload()
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const isDemo = !user

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
