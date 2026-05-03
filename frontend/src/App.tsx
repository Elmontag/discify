import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Fab from './components/Fab'
import CollectionPage from './pages/CollectionPage'
import SettingsPage from './pages/SettingsPage'
import ScanSheet from './pages/ScanSheet'

export default function App() {
  const [scanOpen, setScanOpen] = useState(false)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<CollectionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <BottomNav />
      <Fab onClick={() => setScanOpen(true)} />

      {scanOpen && <ScanSheet onClose={() => setScanOpen(false)} />}
    </div>
  )
}
