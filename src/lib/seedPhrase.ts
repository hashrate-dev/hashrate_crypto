/**
 * Generación de frase semilla (BIP39) y derivación de direcciones (Bitcoin, Litecoin, Dogecoin, Ethereum, Solana).
 * Solana: micro-ed25519-hdkey + path m/44'/501'/0'/0' (cookbook oficial / Phantom al importar frase).
 * Mnemónico normalizado NFKD (estándar BIP39). Solo para uso en cliente; no persiste la frase ni las claves.
 */

import * as bip39 from 'bip39'
import { HDKey } from '@scure/bip32'
import * as bitcoin from 'bitcoinjs-lib'
import { Wallet } from 'ethers'
import { Keypair } from '@solana/web3.js'
import { HDKey as SolanaHDKey } from 'micro-ed25519-hdkey'

const BITCOIN_PATH = "m/84'/0'/0'/0/0"
const LITECOIN_PATH = "m/84'/2'/0'/0/0"
const DOGECOIN_PATH = "m/44'/3'/0'/0/0"
/** Path Solana: Trust Wallet usa m/44'/501'/0'; Phantom usa m/44'/501'/0'/0'. Usamos Trust por defecto. */
const SOLANA_PATH = "m/44'/501'/0'"

/** Seed BIP39 (64 bytes) a hex para micro-ed25519-hdkey (igual que cookbook: seed.toString("hex")). */
function bip39SeedToHex(seed: Buffer | Uint8Array): string {
  const view = seed instanceof Uint8Array ? seed : new Uint8Array(seed)
  return Array.from(view.subarray ? view.subarray(0, 64) : view.slice(0, 64))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

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
  solAddress: string
}

/** Normaliza mnemónico según BIP39 (NFKD) para que el seed coincida con otras wallets. */
function normalizeMnemonic(mnemonic: string): string {
  return (mnemonic || '').trim().normalize('NFKD')
}

/** Deriva todas las direcciones (BTC, LTC, DOGE, ETH) a partir de una frase existente. Útil para rellenar LTC/ETH en cuentas vinculadas antes de añadir esas monedas. */
export function deriveAddressesFromMnemonic(mnemonic: string): Omit<DerivedWallets, 'mnemonic'> {
  const normalized = normalizeMnemonic(mnemonic)
  const seed = bip39.mnemonicToSeedSync(normalized, '')
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

  const ethWallet = Wallet.fromPhrase(normalized)
  const ethAddress = ethWallet.address

  // Solana: micro-ed25519-hdkey + m/44'/501'/0'/0' (cookbook oficial / Phantom al importar)
  const solanaSeedHex = bip39SeedToHex(seed)
  const solHd = SolanaHDKey.fromMasterSeed(solanaSeedHex).derive(SOLANA_PATH)
  const solKeypair = Keypair.fromSeed(solHd.privateKey)
  const solAddress = solKeypair.publicKey.toBase58()

  return { btcAddress, ethAddress, dogeAddress, ltcAddress, solAddress }
}

/** Genera una frase semilla de 12 palabras y deriva direcciones para Bitcoin, Ethereum, Litecoin, Dogecoin y Solana. */
export function generateSeedPhraseAndWallets(): DerivedWallets {
  const mnemonic = bip39.generateMnemonic(128)
  const normalized = normalizeMnemonic(mnemonic)
  const seed = bip39.mnemonicToSeedSync(normalized, '')
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

  const ethWallet = Wallet.fromPhrase(normalized)
  const ethAddress = ethWallet.address

  const solanaSeedHex = bip39SeedToHex(seed)
  const solHd = SolanaHDKey.fromMasterSeed(solanaSeedHex).derive(SOLANA_PATH)
  const solKeypair = Keypair.fromSeed(solHd.privateKey)
  const solAddress = solKeypair.publicKey.toBase58()

  return { mnemonic, btcAddress, ethAddress, dogeAddress, ltcAddress, solAddress }
}

/** Valida que una frase sea un mnemónico BIP39 válido (español o inglés). */
export function isValidMnemonic(phrase: string): boolean {
  return bip39.validateMnemonic(normalizeMnemonic(phrase))
}

/** Deriva solo el Keypair de Solana desde el mnemónico (para firmar transacciones, ej. swap Jupiter). Misma derivación que deriveAddressesFromMnemonic. */
export function getSolanaKeypairFromMnemonic(mnemonic: string): Keypair {
  const normalized = normalizeMnemonic(mnemonic)
  const seed = bip39.mnemonicToSeedSync(normalized, '')
  const solanaSeedHex = bip39SeedToHex(seed)
  const solHd = SolanaHDKey.fromMasterSeed(solanaSeedHex).derive(SOLANA_PATH)
  return Keypair.fromSeed(solHd.privateKey)
}
