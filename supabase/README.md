# Supabase (Auth + datos)

Proyecto de ejemplo en el dashboard: [Supabase](https://supabase.com/dashboard/project/qgdyaxxtszctvhwlylvi).

## 1. Ejecutar la migración SQL

1. Abrí **SQL Editor** en tu proyecto.
2. Pegá el contenido de `migrations/20250308120000_wallet_profiles.sql` y ejecutalo.
3. Si el trigger falla con `execute function`, probá cambiar la última línea del trigger a:
   `execute procedure public.handle_new_user();`

## 2. Auth (registro inmediato)

Para que el usuario quede logueado al registrarse (sin email de confirmación):

**Authentication → Providers → Email** → desactivá *Confirm email* (solo si aceptás el riesgo en producción).

## 3. Cuenta monitor (admin)

```sql
update public.profiles set is_admin = true where email = 'tu-email@dominio.com';
```

## 4. Edge Function `delete-account` (eliminar cuenta)

Desde la carpeta del repo (con [Supabase CLI](https://supabase.com/docs/guides/cli) instalado y vinculado al proyecto):

```bash
supabase functions deploy delete-account --no-verify-jwt
```

`--no-verify-jwt` es correcto: la función valida el JWT a mano y borra el usuario con la service role.

## 5. Variables en Vercel (frontend)

- `VITE_SUPABASE_URL` = **Project URL** (Settings → API), solo `https://TU_REF.supabase.co` — sin `/rest/v1` ni `/auth/v1`.
- `VITE_SUPABASE_ANON_KEY` = anon public key.
- `VITE_API_URL` = sigue siendo necesaria para **proxies** del backend Node (Binance, BTC/SOL/ETH txs, Jupiter, LNbits, etc.) hasta que los portes a Edge Functions.

Cuando `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están definidos, la app usa Supabase para usuarios, PIN (RPC), 2FA (cliente + columna `totp_secret`), logs y monitor (si sos admin).
