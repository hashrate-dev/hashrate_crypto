# Variables de entorno en Vercel (login y API)

Vite **solo** mete en el bundle las variables que empiezan con **`VITE_`** y que existen **en el momento del build**. Si las agregás después, hace falta **Redeploy**.

El archivo **`vercel.json`** excluye **`/api/*`** del fallback a `index.html`, para que **`/api/public-config`** sea la función serverless y no una página HTML (si no, Supabase nunca recibe las claves correctas). La carpeta **`api/`** usa **`api/package.json`** con `"type":"commonjs"` porque el repo raíz tiene `"type":"module"`.

## Opción A — Supabase (recomendado para usuarios / login)

1. En [Supabase](https://supabase.com) → tu proyecto → **Project Settings** → **API**.
2. Copiá **Project URL** y **anon public** key.
3. En [Vercel](https://vercel.com) → tu proyecto → **Settings** → **Environment Variables**:
   | Name | Value |
   |------|--------|
   | `VITE_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` (sin `/rest/v1`) |
   | `VITE_SUPABASE_ANON_KEY` | la clave `anon` `eyJ...` |
4. En **Environments**, activá al menos **Production** (y **Preview** si probás previews).
5. **Deployments** → en el último deploy → **⋯** → **Redeploy** (o empujá un commit nuevo).

### Si te sale “no hay backend configurado” al registrarte

Vite solo empaqueta variables que empiezan con **`VITE_`**. Si en Vercel pusiste **`SUPABASE_URL`** y **`SUPABASE_ANON_KEY`** (sin `VITE_`), el build del front no las ve.

Este proyecto incluye **`/api/public-config`**: en producción el navegador pide esa URL y la función de Vercel devuelve las variables de entorno (incluido `SUPABASE_*`). Podés usar **cualquiera** de estos pares:

- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (recomendado, van en el bundle), **o**
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` (se sirven por `/api/public-config`).

Tras cambiar variables en Vercel, hacé **Redeploy** para que el serverless y el sitio tomen los valores nuevos.

## Opción B — Solo backend Node

Si no usás Supabase para auth:

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://tu-servidor.com` (sin barra final, sin `/api`) |

Redeploy igual.

## Opción A + B

Podés tener **las tres**: Supabase para login/perfil y `VITE_API_URL` para Binance, Jupiter, LNbits, etc.

## Comprobar que entraron al build

En la consola del navegador en tu sitio Vercel **no** deberías poder leer las keys (están en el JS). Si el login sigue fallando, revisá que los nombres sean **exactos** (`VITE_SUPABASE_URL`, no `SUPABASE_URL`).

## Error `401 Unauthorized` en `.../auth/v1/signup` o `.../token`

Eso casi siempre es **clave o URL incorrecta** (no “usuario/contraseña mal” en signup).

1. **`VITE_SUPABASE_ANON_KEY`** tiene que ser la clave **anon public** del **mismo** proyecto que `VITE_SUPABASE_URL`. **No** uses `service_role`.
2. En Vercel, el valor **sin comillas** alrededor (no `"eyJ..."`).
3. La URL debe ser solo `https://xxxxx.supabase.co` (sin `/rest/v1` ni `/auth/v1`).
4. **`VITE_SUPABASE_ANON_KEY` debe incluir el entorno Production** (no solo Preview). Si solo está en Pre-Production, producción usa una key incorrecta o vacía.
5. Tras cambiar variables: **Redeploy**. El sitio también pide **`/api/public-config`** para alinear la key con lo que Vercel tiene en el servidor.
6. **Comprobación:** abrí `https://TU-DOMINIO.vercel.app/api/public-config` — `supabaseAnonKey` debe ser un JWT largo (`eyJ…`) igual al del dashboard. Si está vacío o corto, el valor en Vercel está mal o no aplica a Production.

El código limpia espacios, BOM y comillas accidentales; si sigue 401, copiá de nuevo **anon public** desde **Settings → API**.
