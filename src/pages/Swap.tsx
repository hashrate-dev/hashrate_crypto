import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowDown, Loader2, AlertCircle, CheckCircle2, ExternalLink, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWalletAddresses } from '../hooks/useWalletAddresses'
import { useSolBalance } from '../hooks/useSolBalance'
import { getJupiterQuote, getJupiterSwapTransaction, sendSolanaTransaction, type JupiterQuoteResponse } from '../api/jupiter'
import { getMonitorSwapConfig, logMonitorSwap, logMonitorOperation } from '../api/monitor'
import { getSolanaKeypairFromMnemonic } from '../lib/seedPhrase'
import { getEncryptedSeed } from '../api/users'
import { decryptSeed } from '../lib/seedEncryption'
import { useAuth } from '../context/AuthContext'
import { SOL_LOGO_URL } from '../lib/assetLogos'
import { VersionedTransaction } from '@solana/web3.js'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

const JUPITER_TOKENS = [
  { symbol: 'SOL', mint: SOL_MINT, decimals: 9, logo: SOL_LOGO_URL },
  { symbol: 'USDC', mint: USDC_MINT, decimals: 6, logo: null },
  { symbol: 'USDT', mint: USDT_MINT, decimals: 6, logo: null },
] as const

function toRawAmount(amount: string, decimals: number): string {
  const n = parseFloat(amount)
  if (Number.isNaN(n) || n < 0) return '0'
  return Math.floor(n * Math.pow(10, decimals)).toString()
}

function fromRawAmount(raw: string, decimals: number): string {
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0) return '0'
  return (n / Math.pow(10, decimals)).toFixed(decimals).replace(/\.?0+$/, '') || '0'
}

export function Swap() {
  const { user } = useAuth()
  const { solAddress } = useWalletAddresses()
  const { balanceSol } = useSolBalance(solAddress)
  const [inputToken, setInputToken] = useState<(typeof JUPITER_TOKENS)[number]>(JUPITER_TOKENS[0])
  const [outputToken, setOutputToken] = useState<(typeof JUPITER_TOKENS)[number]>(JUPITER_TOKENS[1])
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<JupiterQuoteResponse | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [swapConfig, setSwapConfig] = useState<{ platformFeeBps: number } | null>(null)
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [password, setPassword] = useState('')
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapError, setSwapError] = useState('')
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadIdRef = useRef(0)

  const hasWallet = !!solAddress?.trim()
  const inputDecimals = inputToken.decimals
  const outputDecimals = outputToken.decimals
  const rawAmount = useMemo(() => toRawAmount(amount, inputDecimals), [amount, inputDecimals])

  const fetchQuote = useCallback(async () => {
    if (!rawAmount || rawAmount === '0') {
      setQuote(null)
      setQuoteError('')
      return
    }
    setQuoteError('')
    setQuoteLoading(true)
    const id = ++loadIdRef.current
    try {
      const q = await getJupiterQuote({
        inputMint: inputToken.mint,
        outputMint: outputToken.mint,
        amount: rawAmount,
      })
      if (id === loadIdRef.current) {
        setQuote(q)
      }
    } catch (e) {
      if (id === loadIdRef.current) {
        setQuote(null)
        setQuoteError(e instanceof Error ? e.message : 'Error al obtener cotización')
      }
    } finally {
      if (id === loadIdRef.current) setQuoteLoading(false)
    }
  }, [inputToken.mint, outputToken.mint, rawAmount])

  useEffect(() => {
    getMonitorSwapConfig()
      .then((c) => setSwapConfig({ platformFeeBps: c.platformFeeBps }))
      .catch(() => setSwapConfig({ platformFeeBps: 20 }))
  }, [])

  useEffect(() => {
    if (!rawAmount || rawAmount === '0') {
      setQuote(null)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchQuote, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [rawAmount, inputToken.mint, outputToken.mint, fetchQuote])

  const outAmount = quote ? fromRawAmount(quote.outAmount || '0', outputDecimals) : ''
  const canConfirm = hasWallet && quote && amount && parseFloat(amount) > 0
  const commissionPct = swapConfig ? (swapConfig.platformFeeBps / 100).toFixed(2) : '0.20'

  useEffect(() => {
    if (user?.id) {
      logMonitorOperation({
        userId: user.id,
        email: user.email ?? '',
        type: 'swap_page_open',
        detail: null,
      }).catch(() => {})
    }
  }, [user?.id, user?.email])

  const handleConfirm = () => {
    if (!canConfirm) return
    setStep('confirm')
    setSwapError('')
    setPassword('')
  }

  const handleExecuteSwap = async () => {
    if (!user || !solAddress || !quote || !password.trim()) return
    setSwapError('')
    setSwapLoading(true)
    try {
      const { encryptedSeed, seedSalt } = await getEncryptedSeed(user.id)
      const phrase = await decryptSeed(encryptedSeed, seedSalt, password.trim())
      const keypair = getSolanaKeypairFromMnemonic(phrase)
      const { swapTransaction: txBase64 } = await getJupiterSwapTransaction({
        quoteResponse: quote,
        userPublicKey: solAddress,
      })
      const txBuf = Buffer.from(txBase64, 'base64')
      const tx = VersionedTransaction.deserialize(txBuf)
      tx.sign([keypair])
      const signedB64 = Buffer.from(tx.serialize()).toString('base64')
      const { signature } = await sendSolanaTransaction(signedB64)
      setTxSignature(signature)
      const platformFeeBps = swapConfig?.platformFeeBps ?? 20
      const commissionApprox = (parseFloat(amount) * (platformFeeBps / 10000)).toFixed(9)
      try {
        await logMonitorSwap({
          userId: user.id,
          email: user.email ?? '',
          inputMint: inputToken.mint,
          outputMint: outputToken.mint,
          inAmount: amount,
          outAmount,
          platformFeeBps,
          commissionApprox,
          txSignature: signature,
        })
      } catch {
        // no bloquear si falla el log del monitor
      }
      setStep('form')
      setAmount('')
      setQuote(null)
      setPassword('')
    } catch (e) {
      setSwapError(e instanceof Error ? e.message : 'Error al ejecutar el swap')
    } finally {
      setSwapLoading(false)
    }
  }

  const swapTokens = () => {
    setInputToken(outputToken)
    setOutputToken(inputToken)
    setAmount(outAmount || amount)
    setQuote(null)
    setQuoteError('')
  }

  const setMaxAmount = () => {
    if (balanceSol != null && inputToken.symbol === 'SOL') {
      const max = Math.max(0, parseFloat(balanceSol) - 0.005)
      setAmount(max.toFixed(6))
    }
  }

  const outputOptions = JUPITER_TOKENS.filter((t) => t.mint !== inputToken.mint)

  return (
    <div className="min-h-full flex flex-col px-4 pt-4 pb-8 safe-bottom">
      <div className="flex items-center gap-3 mb-2">
        <Link
          to="/"
          className="p-2.5 -ml-2 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-center"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Swap</h1>
          <p className="text-white/50 text-xs">Intercambio vía Jupiter en Solana</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {txSignature ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 flex items-center justify-center mb-6"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </motion.div>
            <h2 className="text-lg font-semibold text-white mb-1">Swap enviado correctamente</h2>
            <p className="text-white/50 text-sm mb-4 text-center">
              La transacción fue enviada a la red Solana.
            </p>
            <a
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver en Solscan
            </a>
            <button
              type="button"
              onClick={() => setTxSignature(null)}
              className="mt-6 text-exodus text-sm font-medium hover:underline"
            >
              Hacer otro swap
            </button>
          </motion.div>
        ) : !hasWallet ? (
          <motion.div
            key="nowallet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl border border-amber-500/20 p-6 text-center mt-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-amber-200/90 text-sm font-medium mb-1">Wallet no vinculada</p>
            <p className="text-white/50 text-xs mb-4">Vinculá tu frase semilla para usar Swap en Solana.</p>
            <Link
              to="/billeteras"
              className="inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-exodus/90 hover:bg-exodus text-white font-medium text-sm transition-colors"
            >
              Ir a Billeteras
            </Link>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 mt-2"
          >
            <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="p-4 border-b border-white/5">
                <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Vendes</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {inputToken.logo ? (
                      <img src={inputToken.logo} alt="" className="w-11 h-11 rounded-full object-contain shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {inputToken.symbol.slice(0, 2)}
                      </div>
                    )}
                    <span className="font-semibold text-white truncate">{inputToken.symbol}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value)
                        setQuote(null)
                        setQuoteError('')
                      }}
                      className="w-full min-w-0 max-w-[140px] bg-transparent text-right text-xl font-mono text-white placeholder:text-white/30 outline-none"
                    />
                    {inputToken.symbol === 'SOL' && balanceSol != null && (
                      <button
                        type="button"
                        onClick={setMaxAmount}
                        className="shrink-0 text-xs font-medium text-exodus hover:text-exodus/80 transition-colors"
                      >
                        MAX
                      </button>
                    )}
                  </div>
                </div>
                {inputToken.symbol === 'SOL' && balanceSol != null && (
                  <p className="text-white/40 text-xs mt-1.5">Disponible: {balanceSol} SOL</p>
                )}
              </div>

              <div className="flex justify-center -my-2 relative z-10">
                <button
                  type="button"
                  onClick={swapTokens}
                  className="p-2.5 rounded-full bg-[#0f1729] border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all shadow-lg"
                  aria-label="Invertir tokens"
                >
                  <ArrowDown className="w-5 h-5 text-white/70" />
                </button>
              </div>

              <div className="p-4 pt-2">
                <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Recibís</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {outputToken.logo ? (
                      <img src={outputToken.logo} alt="" className="w-11 h-11 rounded-full object-contain shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {outputToken.symbol.slice(0, 2)}
                      </div>
                    )}
                    <select
                      value={outputToken.mint}
                      onChange={(e) => {
                        const t = JUPITER_TOKENS.find((x) => x.mint === e.target.value)
                        if (t) setOutputToken(t)
                        setQuote(null)
                        setQuoteError('')
                      }}
                      className="bg-transparent text-white font-semibold cursor-pointer outline-none border-none appearance-none pr-6 truncate max-w-[100px]"
                    >
                      {outputOptions.map((t) => (
                        <option key={t.mint} value={t.mint} className="bg-[#0f1729] text-white">
                          {t.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-right font-mono text-white min-w-0">
                    {quoteLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-white/50 inline" />
                    ) : outAmount ? (
                      <span className="text-lg">{outAmount}</span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {quoteError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {quoteError}
              </motion.div>
            )}

            {quote && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2"
              >
                {quote.priceImpactPct != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Impacto en precio</span>
                    <span className={Number(quote.priceImpactPct) > 1 ? 'text-amber-400' : 'text-white/70'}>
                      {Number(quote.priceImpactPct).toFixed(2)}%
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Comisión de plataforma</span>
                  <span className="text-white/70">{commissionPct}%</span>
                </div>
              </motion.div>
            )}

            <p className="text-white/40 text-xs mt-4 leading-relaxed">
              La operación se ejecuta en la red Solana a través de Jupiter. Se aplica una comisión de plataforma configurable desde el monitor.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={fetchQuote}
                disabled={!amount || parseFloat(amount) <= 0 || quoteLoading}
                className="flex-1 py-3.5 rounded-xl bg-white/10 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/15 transition-colors text-sm"
              >
                {quoteLoading ? 'Obteniendo…' : 'Actualizar cotización'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-exodus to-exodus-purple text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95 transition-opacity text-sm shadow-lg shadow-exodus/20"
              >
                Intercambiar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step === 'confirm' && canConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !swapLoading && setStep('form')}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-2xl border border-white/10 p-6 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-white mb-1">Confirmar swap</h3>
            <p className="text-white/60 text-sm mb-4">
              {amount} {inputToken.symbol} → {outAmount} {outputToken.symbol}
            </p>
            <p className="text-white/50 text-xs mb-2">Contraseña de la cuenta (para firmar en Solana)</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-exodus/40 focus:border-exodus/50 mb-4"
              autoComplete="current-password"
            />
            {swapError && (
              <p className="text-rose-400 text-sm mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {swapError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={swapLoading}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteSwap}
                disabled={swapLoading || !password.trim()}
                className="flex-1 py-3 rounded-xl bg-exodus hover:bg-exodus/90 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {swapLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {swapLoading ? 'Enviando…' : 'Firmar y enviar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
