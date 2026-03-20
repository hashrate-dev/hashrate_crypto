import { useAuth } from '../context/AuthContext'
import { initialWalletState } from '../store/wallet'

/** Direcciones efectivas: las derivadas de la frase semilla y guardadas en el usuario (al vincular o generar). Cada frase semilla tiene su propia dirección Solana; el historial de SOL se extrae siempre para la dirección del usuario logueado. */
export function useWalletAddresses() {
  const { user } = useAuth()
  const hasLinkedWallet = !!(user?.btcAddress ?? user?.usdtAddress ?? user?.dogeAddress ?? user?.ltcAddress ?? user?.ethAddress ?? user?.solAddress)
  const ethOrUsdtAddress = user?.ethAddress ?? user?.usdtAddress ?? ''
  return {
    btcAddress: user?.btcAddress ?? '',
    usdtAddress: user?.usdtAddress ?? '',
    dogeAddress: user?.dogeAddress ?? '',
    ltcAddress: user?.ltcAddress ?? '',
    ethAddress: ethOrUsdtAddress,
    /** Dirección Solana de esta wallet (derivada de la frase semilla vinculada). Se usa para balance y para extraer transacciones (Orb/Helius) según la wallet que corresponda. */
    solAddress: user?.solAddress ?? '',
    lightningAddress: user?.lightningAddress ?? user?.email ?? initialWalletState.lightningAddress,
    hasLinkedWallet,
  }
}
