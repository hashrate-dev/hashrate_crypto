# Cómo crear una MEMECOIN en Solana

Hay **dos caminos**: uno rápido sin programar (Pump.fun, Raydium, etc.) y otro técnico creando un token SPL tú mismo.

---

## Opción 1: Lanzar en minutos (sin código) – Recomendada para empezar

### Por qué Solana para memecoins
- Comisiones muy bajas (< 0,01 USD).
- Muchas transacciones por segundo.
- Ecosistema fuerte (WIF, BONK, POPCAT, etc.).

### Pasos con Pump.fun (muy usado)

1. **Monedero Solana**
   - Instala **Phantom** o **Solflare**.
   - Crea/importa una wallet y ten **1–2 SOL** (para fees y liquidez inicial).

2. **Ir a Pump.fun**
   - Entra en [pump.fun](https://pump.fun) y conecta tu wallet.

3. **Crear el token**
   - **Nombre** del token.
   - **Símbolo** (ticker, máx. 8 caracteres).
   - **Descripción** y **imagen/meme**.
   - Confirma la transacción (~0,3–0,8 SOL).

4. **Después del lanzamiento**
   - El token se negocia en la bonding curve de Pump.fun.
   - Cuando la capitalización llegue a ~69K USD, suele migrar automáticamente a **Raydium** (DEX) y el LP se quema (reduce riesgo de “rug pull”).

### Otras plataformas similares (no-code)
- **Raydium LaunchLab**
- **BONK.fun**

**Coste aproximado:** 0,3–0,8 SOL (~45–120 USD).  
**Tiempo:** 2–5 minutos.

---

## Opción 2: Crear un token SPL tú mismo (con control total)

Si quieres **control total** (supply, decimales, metadata, Token-2022), puedes crear un **SPL Token** con la CLI de Solana.

### Requisitos
- **Node.js** (opcional, para scripts).
- **Solana CLI** y **spl-token** instalados.
- Wallet con SOL (en devnet puedes usar airdrop; en mainnet necesitas SOL real).

### 1. Instalar herramientas

```bash
# Solana CLI (incluye solana-keygen, solana config, etc.)
# Desde: https://docs.solana.com/cli/install-solana-cli-tools

# Instalar spl-token
cargo install spl-token-cli
# O con npm:
# npm install -g @solana/spl-token
```

### 2. Configurar red y wallet

```bash
# Usar devnet para pruebas (mainnet para producción)
solana config set --url https://api.devnet.solana.com

# Ver clave pública
solana address

# Airdrop en devnet (solo para pruebas)
solana airdrop 2
```

### 3. Crear el token (mint)

```bash
# Crear el mint (9 decimales es común para memecoins)
spl-token create-token --decimals 9

# Guarda la dirección que devuelve (MINT_ADDRESS)
```

### 4. Crear cuenta de token y mintear supply

```bash
# Crear la cuenta de token asociada a tu wallet
spl-token create-account <MINT_ADDRESS>

# Mintear supply (ej: 1.000.000.000 tokens, con 9 decimales = 1000000000000000000 en unidades base)
spl-token mint <MINT_ADDRESS> 1000000000
```

### 5. (Opcional) Fijar supply y renunciar a mint authority

Para que nadie pueda mintear más (típico en memecoins):

```bash
spl-token authorize <MINT_ADDRESS> mint --disable
```

### 6. Añadir metadata (nombre, símbolo, imagen)

Para que aparezca nombre, símbolo e imagen en wallets y exploradores:

- **Metaplex**: usa el programa **Token Metadata** de Metaplex para asociar nombre, símbolo, URI (imagen) al mint.
- **Metaplex CLI** (si la usas):

```bash
# Ejemplo con Metaplex CLI (instalar según docs de Metaplex)
mplx toolbox token create --name "Mi Memecoin" --symbol "MEME" --mint-amount 1000000 --decimals 9 --image ./meme.png --description "Descripción"
```

En código (JavaScript/TypeScript), se suele usar **@metaplex-foundation/mpl-token-metadata** para crear la cuenta de metadata y vincularla al mint.

---

## Resumen rápido

| Método              | Tiempo   | Coste aprox. | Nivel        |
|---------------------|----------|--------------|-------------|
| Pump.fun / Raydium  | 2–5 min  | 0,3–0,8 SOL  | Sin código  |
| SPL token (CLI)     | 15–40 min| 1–3 SOL      | Técnico     |

- **Solo quieres lanzar una memecoin:** usa **Pump.fun** (o similar).
- **Quieres supply/metadata/Token-2022 a tu medida:** crea un **SPL Token** con `spl-token` + Metaplex (metadata).

---

## Consejos para una memecoin

1. **Nombre corto y memorable** (1–2 sílabas).
2. **Narrativa clara** (meme, historia, comunidad).
3. **Comunidad desde el día 1**: Twitter/X, Telegram.
4. En Pump.fun, la quema automática de LP al migrar a Raydium ayuda a generar **confianza** (menos acusaciones de rug pull).

Si quieres, el siguiente paso puede ser un **script en Node.js** que cree el SPL token y la metadata con Metaplex automáticamente en tu carpeta COIN.
