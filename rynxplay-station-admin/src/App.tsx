import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { Sidebar, Toasts, LoadingScreen } from '@/components'
import { DashboardPage } from '@/pages/DashboardPage'
import { DevicesPage } from '@/pages/DevicesPage'
import { MembersPage } from '@/pages/MembersPage'
import { SessionsPage } from '@/pages/SessionsPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LoginPage } from '@/pages/LoginPage'

// Protected route wrapper
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAppStore()
  
  if (isLoading) {
    return <LoadingScreen />
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <Outlet />
}

// Main layout with sidebar
function MainLayout() {
  const { sidebarOpen } = useAppStore()
  
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="min-h-screen">
          <Outlet />
        </div>
      </main>
      <Toasts />
    </div>
  )
}

function App() {
  const { initialize, isLoading, isAuthenticated } = useAppStore()
  
  useEffect(() => {
    initialize()
  }, [initialize])
  
  if (isLoading) {
    return <LoadingScreen />
  }
  
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} 
        />
        
        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        
        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
