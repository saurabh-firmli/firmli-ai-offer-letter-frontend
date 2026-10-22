# Firmli AI Offer Letter - Frontend

       APP:      http://localhost:3005
       API:      http://localhost:3000/v1/   (firmli-ai-offer-letter-backend)

#### Initialization

        Step 1: npm i
        Step 2: copy .env.example to .env.development.local and fill values
        Step 3: npm start

#### Scripts

        npm start          -- dev server (vite, port 3005)
        npm run build      -- typecheck + production build into dist/
        npm run serve      -- preview the production build
        npm test           -- vitest (files in src/**/*.test.ts(x))

#### Project Structure

    /src
        /layout         -- MainLayout (sidebar + header), navItems, HealthBadge
        /lib            -- api.ts (axios client), queryClient, session (sign out), errors, api hooks
        /pages          -- one file per page
        /test           -- vitest setup
        App.tsx         -- providers + router
        config.ts       -- env (VITE_*)
        routes.ts       -- route paths
        theme.ts        -- Mantine theme
        types.ts        -- shared types (API response shapes)

#### Adding a page

        1. src/pages/Xyz.tsx
        2. routes.ts: RO_XYZ = "/xyz", then add the route in App.tsx (lazy)
        3. if it needs data: a useQuery / useMutation hook in src/lib, using `api` from lib/api.ts
        4. nav entry in layout/navItems.ts

Grow folders only when a file gets crowded (e.g. lib/ -> lib/api/ once there are many hooks).

#### Base conventions

        Env:        only VITE_* vars reach the browser; read them from config.ts,
                    never import.meta.env directly. Add new ones to .env.example + vite-env.d.ts.
        API:        always `import api from "@/lib/api"`. Backend replies { statusCode, data, message, success },
                    so hooks return `data.data`.
        Errors:     lib/errors.ts -> errorHandler(error) in mutation onError shows a notification.
                    Any 401 signs the user out (lib/api.ts -> lib/session.ts signOut).
        Tenancy:    the backend resolves the tenant from the auth token only. Never send tenantId /
                    tenant_id in a body or query. Until auth exists, set VITE_DEV_TENANT_ID (dev only)
                    and the api client sends it as the X-Tenant-Id header.
                    On logout or a user/tenant change call clearSessionData() (lib/session.ts).
        State:      server data lives in react-query; UI state in useState / Mantine hooks.
        Tests:      npm test. Pure logic runs in node; a component test starts with `// @vitest-environment jsdom`.

Happy Coding :-)
