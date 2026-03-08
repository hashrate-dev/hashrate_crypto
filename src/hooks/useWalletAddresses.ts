import { useAuth } from '../context/AuthContext'
import { initialWalletState } from '../store/wallet'

/** Direcciones efectivas: solo las del usuario. Si no vinculó wallet (seed), no usar direcciones de ejemplo. */
export function useWalletAddresses() {
  const { user } = useAuth()
  const hasLinkedWallet = !!(user?.btcAddress ?? user?.usdtAddress ?? user?.dogeAddress)
  return {
    btcAddress: user?.btcAddress ?? '',
    usdtAddress: user?.usdtAddress ?? '',
    dogeAddress: user?.dogeAddress ?? '',
    lightningAddress: user?.lightningAddress ?? user?.email ?? initialWalletState.lightningAddress,
    hasLinkedWallet,
  }
}
