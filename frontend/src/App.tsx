import { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Fab from './components/Fab'
import Sidebar from './components/Sidebar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RefreshProvider } from './context/RefreshContext'
import AdminPage from './pages/AdminPage'
import AuthPage from './pages/AuthPage'
import CollectionPage from './pages/CollectionPage'
import AccountPage from './pages/AccountPage'
import ScanHistoryPage from './pages/ScanHistoryPage'
import SettingsPage from './pages/SettingsPage'
import AddSheet from './pages/AddSheet'

function AppShell() {
  const [scanOpen, setScanOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const showChrome = Boolean(user) && location.pathname !== '/login'

  return (
    <div className="flex h-full">
      {showChrome && <Sidebar onScan={() => setScanOpen(true)} />}

      <main className={`flex-1 overflow-hidden h-full flex flex-col${showChrome ? ' md:ml-16 lg:ml-56' : ''}`}>
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
              <ProtectedRoute adminOnly>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <ScanHistoryPage />
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
      {showChrome && scanOpen && <AddSheet onClose={() => setScanOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <RefreshProvider>
        <AppShell />
      </RefreshProvider>
    </AuthProvider>
  )
}
