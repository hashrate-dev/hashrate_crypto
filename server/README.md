# Backend de usuarios – Volt Wallet

API de registro de usuarios. Cada usuario se identifica por un **ID NUMBER** (numérico, autoincremental) y se relaciona con:

- **email** (único)
- **Primer nombre** (first_name)
- **Segundo nombre** (second_name, opcional)
- **Primer apellido** (first_surname)
- **Segundo apellido** (second_surname, opcional)

## Cómo ejecutar

```bash
cd server
npm install
npm run dev
```

Por defecto el servidor corre en **http://localhost:3001**.

### Variables de entorno (opcional)

Podés crear un archivo `.env` en la carpeta `server` (copiá `.env.example` y editá los valores). Si no existe, el servidor funciona igual.

- **Email al cambiar contraseña**: cuando un usuario cambia su contraseña, se le puede enviar un correo de aviso. Para activarlo, definí en `.env`:
  - `SMTP_USER`: usuario SMTP (ej. tu Gmail)
  - `SMTP_PASS`: contraseña (en Gmail usá una [Contraseña de aplicación](https://support.google.com/accounts/answer/185833), no la contraseña normal)
  - `SMTP_HOST`: por defecto `smtp.gmail.com`
  - `SMTP_PORT`: por defecto `587`
  - `EMAIL_FROM`: remitente visible (opcional)

Si `SMTP_USER` o `SMTP_PASS` no están configurados, el cambio de contraseña se guarda pero no se envía ningún email.

## Endpoints

### POST `/api/register`

Registra un usuario. Body (JSON):

```json
{
  "email": "usuario@ejemplo.com",
  "firstName": "Juan",
  "secondName": "Carlos",
  "firstSurname": "García",
  "secondSurname": "López"
}
```

- **email**, **firstName**, **firstSurname**: obligatorios.
- **secondName**, **secondSurname**: opcionales.

Respuesta 201:

```json
{
  "message": "Usuario registrado correctamente.",
  "user": {
    "id": 1,
    "email": "usuario@ejemplo.com",
    "firstName": "Juan",
    "secondName": "Carlos",
    "firstSurname": "García",
    "secondSurname": "López",
    "createdAt": "2025-03-07 12:00:00"
  }
}
```

Si el email ya existe: **409** con `{ "error": "Ya existe un usuario con ese email." }`.

### GET `/api/users/:id`

Devuelve el usuario con ese **ID NUMBER**. Respuesta 200 con `{ "user": { ... } }`. Si no existe: **404**.

### GET `/api/users/by-email/:email`

Devuelve el usuario con ese email (el segmento `:email` debe ir codificado en URL). Respuesta 200 con `{ "user": { ... } }`. Si no existe: **404**.

## Base de datos

Los usuarios se guardan en `server/data/users.json`. La carpeta `data` y el archivo se crean solos al registrar el primer usuario. No hace falta instalar SQLite ni Python.
