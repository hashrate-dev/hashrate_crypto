import type { User } from './users'

export type ProfileRow = {
  id: string
  numeric_id: number
  email: string
  first_name: string
  second_name: string | null
  first_surname: string
  second_surname: string | null
  created_at: string
  btc_address: string | null
  usdt_address: string | null
  doge_address: string | null
  ltc_address: string | null
  eth_address: string | null
  sol_address: string | null
  lightning_address: string | null
  encrypted_seed: string | null
  seed_salt: string | null
  totp_secret: string | null
  pin_hash: string | null
}

export function profileRowToUser(row: ProfileRow): User {
  return {
    id: Number(row.numeric_id),
    email: row.email,
    firstName: row.first_name,
    secondName: row.second_name,
    firstSurname: row.first_surname,
    secondSurname: row.second_surname,
    createdAt: row.created_at.slice(0, 19).replace('T', ' '),
    btcAddress: row.btc_address,
    usdtAddress: row.usdt_address,
    dogeAddress: row.doge_address,
    ltcAddress: row.ltc_address,
    ethAddress: row.eth_address,
    solAddress: row.sol_address,
    lightningAddress: row.lightning_address,
    totpEnabled: !!(row.totp_secret && String(row.totp_secret).trim() !== ''),
  }
}
