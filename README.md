# QMS POS Pro

Offline-first Point of Sale and business management system for retail shops in Pakistan and the Gulf.

## Features

- **Billing / POS** — barcode search, cart, discounts, multi-tender (Cash, Card, JazzCash, EasyPaisa, Credit)
- **Inventory** — products, categories, stock adjustments, CSV import
- **Customers** — credit balances and collections
- **Sales history** — filters, profit visibility by role, export
- **Expenses** — cash vs non-cash expenses
- **End-of-day close** — drawer variance, append-only amendments
- **Multi-branch** — up to 10 branches with switcher
- **Role-based access** — admin, manager, cashier, accountant
- **Tax** — inclusive or exclusive rates, printed on receipts
- **Offline / PWA** — works without network; data stays in the browser
- **Backup / restore** — JSON export (PINs never included)

## Demo staff PINs

| Role        | PIN  |
|-------------|------|
| Owner (admin) | `1234` |
| Manager     | `2468` |
| Cashier     | `0000` |
| Accountant  | `1357` |

PINs are hashed with a random salt on first successful login or after “Reset data”. Backups never contain PIN material.

## Tech stack

- React 19 + TypeScript
- TanStack Start / Router / Query
- Zustand (persisted offline store)
- Tailwind CSS v4
- Vite + Nitro (Vercel-ready)

## Local development

```bash
npm install
npm run dev          # http://0.0.0.0:8080
npm run typecheck
npm test
npm run build
```

## Production notes

1. **Data lives in the browser** (`localStorage`). Always export a backup and store it off-device.
2. **Service worker** caches the shell for offline use (`public/sw.js`).
3. **Permissions** are enforced in the store, not only in the UI.
4. **Day close** blocks further sales for that business date + branch until the next day.
5. Change default demo PINs under **Settings → Staff PINs** before real use.
6. Deploy to Vercel (or any static/SSR host that supports the Vite + Nitro build).

## Security

- Staff PINs are stored as salted hashes (SHA-256 when Web Crypto is available).
- Sign-in locks after 5 consecutive failures until the page is reloaded / store reset by an admin path.
- Backup JSON strips all PIN fields; restore never overwrites current PIN hashes from a file.

## License

Private — all rights reserved.
