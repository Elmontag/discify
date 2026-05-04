/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface RefreshState {
  collectionVersion: number
  historyVersion: number
  userVersion: number
  bumpCollection: () => void
  bumpHistory: () => void
  bumpUser: () => void
}

const RefreshContext = createContext<RefreshState | null>(null)

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [collectionVersion, setCollectionVersion] = useState(0)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [userVersion, setUserVersion] = useState(0)

  const bumpCollection = useCallback(() => setCollectionVersion((v) => v + 1), [])
  const bumpHistory = useCallback(() => setHistoryVersion((v) => v + 1), [])
  const bumpUser = useCallback(() => setUserVersion((v) => v + 1), [])

  return (
    <RefreshContext.Provider
      value={{ collectionVersion, historyVersion, userVersion, bumpCollection, bumpHistory, bumpUser }}
    >
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh() {
  const ctx = useContext(RefreshContext)
  if (!ctx) throw new Error('useRefresh must be used within RefreshProvider')
  return ctx
}
