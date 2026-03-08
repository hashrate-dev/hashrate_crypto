import { Routes, Route, Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { RequireAuth } from './components/RequireAuth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { Mercado } from './pages/Mercado'
import { MercadoAsset } from './pages/MercadoAsset'
import { Send } from './pages/Send'
import { Receive } from './pages/Receive'
import { History } from './pages/History'
import { Settings } from './pages/Settings'
import { Security } from './pages/Security'
import { Appearance } from './pages/Appearance'
import { Notifications } from './pages/Notifications'
import { Configuracion } from './pages/Configuracion'
import { SeedPhraseGenerator } from './pages/SeedPhraseGenerator'
import { LightningAddress } from './pages/LightningAddress'
import { Billeteras } from './pages/Billeteras'
import { MonitorDashboard } from './pages/MonitorDashboard'
import { NotificationProvider } from './context/NotificationContext'

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <NotificationProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<MonitorDashboard />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout>
                <Outlet />
              </Layout>
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="mercado" element={<Mercado />} />
          <Route path="mercado/:assetId" element={<MercadoAsset />} />
          <Route path="send" element={<Send />} />
          <Route path="receive" element={<Receive />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
          <Route path="security" element={<Security />} />
          <Route path="appearance" element={<Appearance />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="configuration" element={<Configuracion />} />
          <Route path="Cuenta" element={<Configuracion />} />
          <Route path="billeteras" element={<Billeteras />} />
          <Route path="seed-phrase" element={<SeedPhraseGenerator />} />
          <Route path="lightning-address" element={<LightningAddress />} />
        </Route>
      </Routes>
    </NotificationProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}
