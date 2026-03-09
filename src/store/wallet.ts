export type AssetType = 'btc' | 'btc_lightning' | 'usdt' | 'doge' | 'ltc' | 'eth';

export interface Balance {
  asset: AssetType;
  amount: string;
  amountUsd?: string;
}

export interface Transaction {
  id: string;
  type: 'send' | 'receive';
  asset: AssetType;
  amount: string;
  amountUsd?: string;
  counterparty: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
  txHash?: string;
  isLightning?: boolean;
}

export interface WalletState {
  balances: Balance[];
  transactions: Transaction[];
  btcAddress: string;
  lightningAddress: string;
  usdtAddress: string;
  dogeAddress: string;
  ltcAddress: string;
  ethAddress: string;
}

const DEMO_BTC = '0.054291';
const DEMO_USDT = '1250.00';
const DEMO_BTC_USD = '3247.52';
const DEMO_USDT_USD = '1250.00';

export const initialWalletState: WalletState = {
  balances: [
    { asset: 'btc', amount: DEMO_BTC, amountUsd: DEMO_BTC_USD },
    { asset: 'btc_lightning', amount: '0.002100', amountUsd: '125.80' },
    { asset: 'usdt', amount: DEMO_USDT, amountUsd: DEMO_USDT_USD },
    { asset: 'doge', amount: '0', amountUsd: '0' },
    { asset: 'ltc', amount: '0', amountUsd: '0' },
    { asset: 'eth', amount: '0', amountUsd: '0' },
  ],
  transactions: [
    { id: '1', type: 'receive', asset: 'btc_lightning', amount: '0.000500', amountUsd: '30.00', counterparty: 'alice@getalby.com', timestamp: Date.now() - 3600000, status: 'completed', isLightning: true },
    { id: '2', type: 'send', asset: 'usdt', amount: '50.00', amountUsd: '50.00', counterparty: '0x742d...8f2a', timestamp: Date.now() - 86400000, status: 'completed' },
    { id: '3', type: 'receive', asset: 'btc', amount: '0.001', amountUsd: '60.00', counterparty: 'bc1q...xyz', timestamp: Date.now() - 172800000, status: 'completed' },
  ],
  btcAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  lightningAddress: 'you@volt.app',
  usdtAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e2',
  dogeAddress: '',
  ltcAddress: '',
  ethAddress: '',
};

export function getTotalUsd(balances: Balance[]): string {
  const total = balances.reduce((sum, b) => sum + parseFloat(b.amountUsd || '0'), 0);
  return total.toFixed(2);
}

export function formatBalance(amount: string, asset: AssetType): string {
  if (asset === 'usdt') return parseFloat(amount).toFixed(2);
  if (asset === 'eth') return parseFloat(amount).toFixed(6);
  return parseFloat(amount).toFixed(8);
}

export function getAssetLabel(asset: AssetType): string {
  switch (asset) {
    case 'btc': return 'Bitcoin';
    case 'btc_lightning': return 'Lightning';
    case 'usdt': return 'USDT';
    case 'doge': return 'Dogecoin';
    case 'ltc': return 'Litecoin';
    case 'eth': return 'Ethereum';
    default: return asset;
  }
}

/** Nombre principal en lista (ej. Mercado/Activos): para Lightning "Bitcoin", para USDT "Tether". */
export function getAssetPrimaryName(asset: AssetType): string {
  switch (asset) {
    case 'btc':
    case 'btc_lightning': return 'Bitcoin';
    case 'usdt': return 'Tether';
    case 'doge': return 'Dogecoin';
    case 'ltc': return 'Litecoin';
    case 'eth': return 'Ethereum';
    default: return getAssetLabel(asset);
  }
}

/** Línea secundaria en lista: para Lightning "Lightning", para btc "BTC", para USDT "USDT". */
export function getAssetSecondaryName(asset: AssetType): string {
  switch (asset) {
    case 'btc': return 'BTC';
    case 'btc_lightning': return 'Lightning';
    case 'usdt': return 'USDT';
    case 'doge': return 'DOGE';
    case 'ltc': return 'LTC';
    case 'eth': return 'ETH';
    default: return getAssetSymbol(asset);
  }
}

export function getAssetSymbol(asset: AssetType): string {
  switch (asset) {
    case 'btc':
    case 'btc_lightning': return 'BTC';
    case 'usdt': return 'USDT';
    case 'doge': return 'DOGE';
    case 'ltc': return 'LTC';
    case 'eth': return 'ETH';
    default: return '';
  }
}

/** Datos de precio para sparklines (últimos días). Valores de ejemplo por activo. */
export const assetChartData: Record<AssetType, number[]> = {
  btc: [59800, 61200, 60500, 61800, 62400, 61900, 63100, 62800, 63500, 64200, 63800, 64500, 65200, 64800, 65500, 66100, 65800, 66400, 67200, 66800, 67500, 68200, 67800, 68500, 69200, 68800, 69500, 70200],
  btc_lightning: [59800, 61200, 60500, 61800, 62400, 61900, 63100, 62800, 63500, 64200, 63800, 64500, 65200, 64800, 65500, 66100, 65800, 66400, 67200, 66800, 67500, 68200, 67800, 68500, 69200, 68800, 69500, 70200],
  usdt: [1, 1, 1.001, 0.999, 1, 1, 0.999, 1.001, 1, 1, 1, 0.999, 1.001, 1, 1, 1, 1.001, 0.999, 1, 1, 1, 1, 1.001, 0.999, 1, 1, 1, 1],
  doge: [0.08, 0.082, 0.081, 0.083, 0.082, 0.084, 0.083, 0.085, 0.084, 0.086, 0.085, 0.087, 0.086, 0.088, 0.087, 0.089, 0.09, 0.089, 0.091, 0.09, 0.092, 0.091, 0.093, 0.092, 0.094, 0.093, 0.095, 0.094],
  ltc: [82, 84, 83, 85, 84, 86, 85, 87, 86, 88, 87, 89, 90, 89, 91, 90, 92, 91, 93, 92, 94, 93, 95, 94, 96, 95, 97, 96],
  eth: [3450, 3520, 3480, 3550, 3580, 3620, 3600, 3650, 3680, 3720, 3700, 3750, 3780, 3820, 3800, 3850, 3880, 3920, 3900, 3950, 3980, 4020, 4000, 4050, 4080, 4120, 4100, 4150],
};
