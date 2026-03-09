/**
 * Generación de frase semilla (BIP39) y derivación de direcciones (Bitcoin, Litecoin, Dogecoin, Ethereum).
 * La dirección Litecoin (formato ltc1...) se deriva siempre de la frase semilla (BIP84, path m/84'/2'/0'/0/0).
 * Solo para uso en cliente; no persiste la frase ni las claves.
 */

import * as bip39 from 'bip39'
import { HDKey } from '@scure/bip32'
import * as bitcoin from 'bitcoinjs-lib'
import { Wallet } from 'ethers'

const BITCOIN_PATH = "m/84'/0'/0'/0/0"
const LITECOIN_PATH = "m/84'/2'/0'/0/0"
const DOGECOIN_PATH = "m/44'/3'/0'/0/0"

const dogecoinNetwork: bitcoin.Network = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'doge',
  bip32: { public: 0x02fac398, private: 0x02facafd },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
}

const litecoinNetwork: bitcoin.Network = {
  messagePrefix: '\x19Litecoin Signed Message:\n',
  bech32: 'ltc',
  bip32: { public: 0x019da462, private: 0x019d9cfe },
  pubKeyHash: 0x30,
  scriptHash: 0x32,
  wif: 0xb0,
}

export interface DerivedWallets {
  mnemonic: string
  btcAddress: string
  ethAddress: string
  dogeAddress: string
  ltcAddress: string
}

/** Deriva todas las direcciones (BTC, LTC, DOGE, ETH) a partir de una frase existente. Útil para rellenar LTC/ETH en cuentas vinculadas antes de añadir esas monedas. */
export function deriveAddressesFromMnemonic(mnemonic: string): Omit<DerivedWallets, 'mnemonic'> {
  const seed = bip39.mnemonicToSeedSync(mnemonic.trim())
  const root = HDKey.fromMasterSeed(seed)

  const btcChild = root.derive(BITCOIN_PATH)
  if (!btcChild.publicKey) throw new Error('No Bitcoin public key')
  const btcPayment = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(btcChild.publicKey),
  })
  const btcAddress = btcPayment.address ?? ''

  // Litecoin: dirección ltc1... derivada de la frase semilla (BIP84, native SegWit)
  const ltcChild = root.derive(LITECOIN_PATH)
  if (!ltcChild.publicKey) throw new Error('No Litecoin public key')
  const ltcPayment = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(ltcChild.publicKey),
    network: litecoinNetwork,
  })
  const ltcAddress = ltcPayment.address ?? '' // formato ltc1... (derivada de la seed phrase)

  const dogeChild = root.derive(DOGECOIN_PATH)
  if (!dogeChild.publicKey) throw new Error('No Dogecoin public key')
  const dogePayment = bitcoin.payments.p2pkh({
    pubkey: Buffer.from(dogeChild.publicKey),
    network: dogecoinNetwork,
  })
  const dogeAddress = dogePayment.address ?? ''

  const ethWallet = Wallet.fromPhrase(mnemonic.trim())
  const ethAddress = ethWallet.address

  return { btcAddress, ethAddress, dogeAddress, ltcAddress }
}

/** Genera una frase semilla de 12 palabras y deriva Bitcoin (bc1q), Ethereum (0x), Litecoin (ltc1) y Dogecoin (D...). */
export function generateSeedPhraseAndWallets(): DerivedWallets {
  const mnemonic = bip39.generateMnemonic(128)
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const root = HDKey.fromMasterSeed(seed)

  const btcChild = root.derive(BITCOIN_PATH)
  if (!btcChild.publicKey) throw new Error('No Bitcoin public key')
  const btcPayment = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(btcChild.publicKey),
  })
  const btcAddress = btcPayment.address ?? ''

  // Litecoin: dirección ltc1... derivada de la frase semilla (BIP84, native SegWit)
  const ltcChild = root.derive(LITECOIN_PATH)
  if (!ltcChild.publicKey) throw new Error('No Litecoin public key')
  const ltcPayment = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(ltcChild.publicKey),
    network: litecoinNetwork,
  })
  const ltcAddress = ltcPayment.address ?? '' // formato ltc1... (derivada de la seed phrase)

  const dogeChild = root.derive(DOGECOIN_PATH)
  if (!dogeChild.publicKey) throw new Error('No Dogecoin public key')
  const dogePayment = bitcoin.payments.p2pkh({
    pubkey: Buffer.from(dogeChild.publicKey),
    network: dogecoinNetwork,
  })
  const dogeAddress = dogePayment.address ?? ''

  const ethWallet = Wallet.fromPhrase(mnemonic)
  const ethAddress = ethWallet.address

  return { mnemonic, btcAddress, ethAddress, dogeAddress, ltcAddress }
}

/** Valida que una frase sea un mnemónico BIP39 válido (español o inglés). */
export function isValidMnemonic(phrase: string): boolean {
  return bip39.validateMnemonic(phrase.trim())
}
