import { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Fab from './components/Fab'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import AdminPage from './pages/AdminPage'
import AuthPage from './pages/AuthPage'
import CollectionPage from './pages/CollectionPage'
import AccountPage from './pages/AccountPage'
import SettingsPage from './pages/SettingsPage'
import ScanSheet from './pages/ScanSheet'

function AppShell() {
  const [scanOpen, setScanOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const showChrome = Boolean(user) && location.pathname !== '/login'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CollectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {showChrome && <BottomNav />}
      {showChrome && <Fab onClick={() => setScanOpen(true)} />}
      {showChrome && scanOpen && <ScanSheet onClose={() => setScanOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
