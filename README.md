# Volt — Wallet de Bitcoin (Lightning) y USDT

App wallet moderna inspirada en Strike: Bitcoin (on-chain y **Lightning Network**) y USDT, con interfaz oscura y fluida.

## Características

- **Dashboard**: Balance total en USD, tarjetas por activo (Bitcoin, Lightning, USDT) y actividad reciente
- **Enviar**: Flujo por pasos (activo → monto → dirección/factura) con validación de direcciones Lightning (lnbc... o usuario@dominio), Bitcoin (bc1...) y USDT (0x...)
- **Recibir**: QR y direcciones para Bitcoin, Lightning y USDT; copiar al portapapeles
- **Historial**: Listado de transacciones con tipo, contraparte y monto
- **Ajustes**: Seguridad, notificaciones, apariencia y ayuda (placeholders para producción)

## Cómo ejecutarla

```bash
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).

Build de producción:

```bash
npm run build
npm run preview
```

## Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** (tema oscuro, glassmorphism, colores BTC/Lightning/USDT)
- **Framer Motion** (animaciones y transiciones)
- **React Router** (navegación)
- **Lucide React** (iconos)
- **qrcode.react** (QR para recibir)

## Nota

Es una **demo de interfaz**: los saldos y las transacciones son datos de ejemplo. Para una wallet real haría falta integrar backend, nodo Lightning (LND/CLN) o servicios como Strike API, y custodia segura de claves.
