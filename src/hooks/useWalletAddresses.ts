import { useAuth } from '../context/AuthContext'
import { initialWalletState } from '../store/wallet'

/** Direcciones efectivas: las derivadas de la frase semilla y guardadas en el usuario (al vincular o generar). Sin ejemplos. */
export function useWalletAddresses() {
  const { user } = useAuth()
  const hasLinkedWallet = !!(user?.btcAddress ?? user?.usdtAddress ?? user?.dogeAddress ?? user?.ltcAddress ?? user?.ethAddress)
  // Misma dirección para USDT (ERC-20) y ETH nativo
  const ethOrUsdtAddress = user?.ethAddress ?? user?.usdtAddress ?? ''
  return {
    btcAddress: user?.btcAddress ?? '',
    usdtAddress: user?.usdtAddress ?? '',
    dogeAddress: user?.dogeAddress ?? '',
    ltcAddress: user?.ltcAddress ?? '', // Misma dirección LTC de la frase semilla (Recibir Litecoin usa esta + QR)
    ethAddress: ethOrUsdtAddress,
    lightningAddress: user?.lightningAddress ?? user?.email ?? initialWalletState.lightningAddress,
    hasLinkedWallet,
  }
}
