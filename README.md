# Firmli AI Offer Letter - Frontend

       APP:      http://localhost:3005
       API:      http://localhost:5000/v1/   (firmli-ai-offer-letter-backend)

#### Initialization

        Step 1: npm i
        Step 2: copy .env.example to .env.development.local and fill values
        Step 3: npm start

#### Scripts

        npm start          -- dev server (vite, port 3005)
        npm run build      -- typecheck + production build into dist/ (needs VITE_API_BASE_URL)
        npm run serve      -- preview the production build
        npm test           -- vitest (files in src/**/*.test.ts(x))
        npm run lint       -- eslint
        npm run format     -- prettier --write
        npm run check      -- typecheck + lint + format check + tests; run before pushing

A build fails without VITE_API_BASE_URL (set it in .env, the environment or the Docker build arg),
so a bundle can never ship pointing at localhost.

#### Project Structure

    /src
        /components     -- shared UI (see "UI conventions"): Page, PageHeader, DataState, RowActions, RequirePermission, confirmDanger,
                           FormModal, FormDrawer, FormHeader, FormSection, FormActions, SectionTitle,
                           OptionCards, StatusDot, SearchableSelect, PeriodFilter, TrendChart, SidePanel, StatusScreen, TemplatePreview (PreviewModal + TemplateHtml),
                           Skeletons (Table / List / Card / Form / Page / App)
        /layout         -- MainLayout (sidebar + header, needs login), AuthLayout (login page), navItems
        /lib            -- api.ts (axios client), session (token, sign out), errors, forms, utils, useVariableInsertion,
                           one file of types + react-query hooks per module (programs, campuses, users, auth, locations)
        /pages          -- one file per page, plus its form (ProgramForm, CampusForm, UserForm)
        /test           -- vitest setup
        App.tsx         -- providers + router
        config.ts       -- env (VITE_*)
        routes.ts       -- route paths
        theme.ts        -- Mantine theme and Firmli color tokens (the only file with color values)
        types.ts        -- shared API response shapes

#### Adding a module (e.g. letter templates)

        1. src/lib/xyz.ts            -- types + useXyz / useSaveXyz / useDeleteXyz, using `api` from lib/api.ts
        2. src/pages/Xyz.tsx         -- PageHeader + Card + DataState + Table with RowActions (copy Campuses.tsx)
        3. src/pages/XyzForm.tsx     -- useForm + useResetOnOpen + applyFormError (copy CampusForm.tsx)
        4. routes.ts: RO_XYZ = "/xyz" and the route in App.tsx (lazy, inside <RequirePermission module="xyz">)
        5. nav entry in layout/navItems.ts with module: "xyz" (shown only with read permission); if the
           entry already exists, remove its soon: true (that is what shows "Soon" in the sidebar)

Grow folders only when a file gets crowded (e.g. lib/ -> lib/api/ once there are many hooks).

#### UI conventions

Every screen must look like the same app. Reuse these instead of building a new variant;
if a pattern is needed a second time, add it to src/components and list it here.

        List page:  Page (padding / spacing) -> PageHeader (title + "New X" button) -> Card -> filters row -> DataState
                    (loading / error / empty) -> Table with RowActions (edit / delete). The first column is
                    "#" (components/TableSerial: SerialHead / SerialCell, with the page offset on paged lists).
                    A row click opens the item: rowClick(...) from RowActions on the Tr (RowActions
                    stops the click itself). Things read together share a cell (name + code, status +
                    a dimmed line under it) so the table fits a 1440px screen without scrolling.
                    Filters: w={{ base: "100%", sm: N }}, so they stack full width on a phone.
                    Cells (components/TableCells): the first column is EntityCell (icon tile + name + one
                    dimmed line) or PersonCell (initials tile) for people; dates are DateCell (date, time
                    under it). Tables use verticalSpacing="sm" horizontalSpacing="sm"; the header style
                    (small grey caps) comes from theme.ts. Row icons are grey and take their colour
                    (red for delete) only on hover. A row with several actions puts them in RowActions'
                    menu ("..."): every action the role may use, greyed with a disabledReason line when
                    the API would refuse it now (Applications: Run Assessment, Generate Letter, Send
                    Email, Download PDF on a submitted application).
        Permissions: hide what the role can't do: can("xyz", "create") on the New button,
                    RowActions gets onEdit / onDelete only with update / delete (a missing one hides its icon).
                    Routes: RequirePermission checks read; a page that only creates or edits passes
                    action (New Application: create, continue a draft: update).
        List+detail: a list on the left, the chosen item on the right (Eligibility, Roles) ->
                    SidePanel / SidePanelList / SidePanelItem in a Grid (4 / 8).
        Delete:     confirmDanger() (danger + secondary buttons). Success -> green toast.
        Forms:      small form -> FormModal; long form -> FormDrawer (right drawer, sticky footer,
                    asks before discarding changes) with FormSection blocks.
                    Header via FormHeader (title + one line, no icon). Groups via FormSection / SectionTitle.
                    Footer via FormActions (Cancel + submit, no icon on the submit).
                    One-of-few fixed choices (status, mode, letter type) -> OptionCards, not a Select;
                    a list that can grow (roles, campuses) -> SearchableSelect, never cards;
                    a status option gets a StatusDot in its badge color.
        Naming:     page button + form title "New X" / "Edit X"; submit "Create X" / "Save Changes";
                    toasts "X created" / "X updated" / "X deleted". Labels in Title Case.
                    X is the same full name everywhere ("Email Template", "Eligibility Set", "Document
                    Requirement"; never just "Template" / "Set" / "Document"). Every success toast has
                    that title and the record's name as its message, deletes included.
        Dropdowns:  searchable -> SearchableSelect (never <Select searchable>: a text field there gets
                    Chrome address / earlier-entry suggestions). Short fixed lists -> Select.
        Inputs:     placeholders "e.g. ..." for text, "Select ..." for dropdowns; a disabled
                    field says what it waits for ("Select a country first"). Required -> withAsterisk.
        Loading:    a skeleton shaped like the content (components/Skeletons; DataState shows a table one
                    by default), never a spinner; a spinner only inside a button for an action in progress.
                    A load that fails shows components/ErrorState (DataState does it for lists): the kind of
                    failure in plain words (lib/errors.ts describeError: offline / server down, timeout,
                    500 with its request id, no permission, not found) and Try Again, which reloads the
                    page's queries. Never a raw "Network Error".
                    The one exception: the whole app starting (MainLayout loading the user) shows
                    components/AppLoader, a branded splash, since there is no page yet to shape a skeleton on.
        Look:       colors only from theme.ts (see Colors below), radius md, Button variants
                    primary / secondary / tertiary / danger.

#### Base conventions

        Env:        only VITE_* vars reach the browser; read them from config.ts,
                    never import.meta.env directly. Add new ones to .env.example + vite-env.d.ts.
        API:        always `import api from "@/lib/api"`. Backend replies { statusCode, data, message, success },
                    so hooks return `data.data`.
        Errors:     lib/errors.ts -> errorHandler(error) in mutation onError shows a notification
                    in the same words as ErrorState (describeError; the X-Request-Id on 5xx). Dates go
                    to the API with toApiDate (lib/utils.ts). In forms, applyFormError (lib/forms.ts) puts a 409
                    under its field, 422 messages under theirs and the rest in a toast.
                    Queries retry only on 429.
        Auth:       login answers an access token (lib/session.ts, localStorage "token", 15 minutes) and
                    sets the session cookie (httpOnly "firmli_refresh", 30 days from its last use).
                    lib/api.ts sends the token as `Authorization: Bearer <token>`, every request with
                    credentials (the backend's CORS_ORIGINS must list this app's exact address). A 401
                    SESSION_ENDED gets a new token once (POST /auth/refresh, one at a time for all failed
                    requests) and sends the request again; when that fails, or on any other 401 (except a
                    wrong password on the login form), it logs out and opens /login?reason=expired, or
                    ?reason=inactive when the user is no longer active (blocked, banned, ...).
                    MainLayout sends logged out users to /login?next=<page> and loads the user
                    with GET /auth/me. Logout = logOut() (lib/auth.ts): POST /auth/logout ends this device's
                    session, then signOut("logout"); logOutEverywhere() (My Profile) = POST /auth/logout-all. Passwords: Change Password on My Profile
                    (/profile, pages/Profile.tsx: account, Edit Name via PATCH /auth/me, the role's access, password,
                    log out everywhere; stores the new token),
                    Forgot password on the login page (/forgot-password) and the emailed link
                    (/reset-password?token=..., checked first, then logs the user in). A reset of someone
                    else's password on the user form logs them out everywhere; your own goes through Change Password.
                    Login, logout and a user change clear all cached data (clearSessionData()).
                    No signup: Firmli creates each tenant (company) and its first admin.
        Roles:      Super Admin, Institution Admin, Admissions Officer, Reviewer, Read Only (GET /roles,
                    lib/roles.ts; needs roles read; colors / icons go by list order, never by code).
                    /auth/me carries the role's permissions { module: { create, read, update, delete } }; useCan() (lib/auth.ts)
                    reads them for menus, routes (RequirePermission) and buttons. The API checks them too
                    (403), by HTTP method: POST create, PUT / PATCH update, DELETE delete.
                    Roles & Permissions (pages/Roles.tsx) needs roles read; with roles update, an
                    editable role's switches can be changed (PUT /roles/:id/permissions, this tenant only;
                    the Super Admin role is locked). Anyone but a Super Admin can't edit their own role, and
                    can only turn on switches their own role has (both answer 403 otherwise).
                    Only a Super Admin may add / change / remove a Super
                    Admin user. Audit Log (pages/AuditLogs.tsx): the API returns everyone's changes to a
                    Super Admin and only their own to the other roles.
                    Settings (pages/Settings.tsx, lib/settings.ts): one record per tenant; read to see, update
                    to save (PATCH /settings, whole form). Thresholds are 0 to 1 in the API, % on screen.
                    The institution's OpenAI key (AI Configuration) is write only: the API returns it masked,
                    so the field starts empty and is sent only when typed (or null by Remove Key).
                    aiConfigured = a key is saved ("AI Active").
                    Email: emailSender says who students see mail from. "Use our own email server" (smtp*
                    fields) needs server, port and from email; smtpPassword is write only like the key
                    ("" removes it). Send Test Email (POST /settings/test-email) uses the saved settings, so
                    it waits until the form is saved; a refusing server's 502 message is shown as is.
                    Letter Branding (pages/SettingsBranding.tsx): the logo uploads at once (PUT / DELETE
                    /settings/logo, PNG or JPG up to 2 MB) and only patches settings.logo in the cache, so
                    unsaved form edits stay; logo.url is a short-lived link, never stored. brandColor
                    (#RRGGBB, "" = Firmli navy) saves with the form. The letterhead preview follows the form.
        AI Assessment: the "AI Assessment" card on an application (pages/ApplicationAssessment.tsx,
                    lib/assessments.ts). Run Assessment (POST /applications/:id/assess, 202) is blocked with a
                    reason for drafts, a run in progress and manual review; the latest run is polled every 3s
                    while in progress, and the application, queue and dashboard reload when it ends. Each
                    criterion shows "Found 3.62 · needs ≥ 3.0" with its evidence and source file.
        Notes:      lib/notes.ts. On the application page (pages/ApplicationNotes.tsx, Applications create)
                    and as "Add Review Note" on a review case (any status, Manual Review update); every note
                    shows on the application. Notes can't be edited or deleted.
        Extract:    the sparkle icon on a file opens its AI reading (pages/DocumentReadingModal.tsx) with
                    Extract Now / Read Again (Applications create); it never changes the application.
        Live:       lib/live.ts, one Server-Sent Events stream while logged in (useLiveUpdates in the layout;
                    a new ticket from POST /events/ticket on every (re)connect; live.stop() on logout). Each
                    event refetches its react-query keys, the bell and the dashboard, debounced: once, 1 s
                    after the last event plus 0-1 s at random (every tab of the institution gets every
                    event); only queries on screen refetch, a hidden tab waits until it is visible again, and
                    a running fetch is reused. After a drop, the open page refetches once. A run is polled
                    every 10s only while the stream is down.
        Bell:       components/NotificationBell.tsx: GET /notifications, refetched by lib/live.ts (events and a
                    60s safety poll, through the same debounce so they never both call); an item opens its
                    list filtered by URL (?status=unassigned, ?mine=1, ?assessmentStatus=failed,
                    ?status=submitted, Letters ?status=pending_approval), which the lists read on load and
                    on change.
        Letters:    lib/letters.ts, module "letters". /letters (pages/Letters.tsx): the approvals page, status
                    chips with counts, Review / Download PDF / Approve / Reject. pages/LetterView.tsx shows the
                    PDF itself in an iframe (download-url?inline=true, a fresh link each time it opens:
                    useLetterViewUrl), so the view has the letterhead, logo and colours the student gets; the
                    letter's HTML has none of them and is not shown. Open in New Tab for phones (they may show
                    only page 1 inline). Approve / Reject (a reason is required). The application page has a Letter card
                    (pages/ApplicationLetters.tsx): Generate Letter / Generate Again, the current letter and the
                    earlier ones. Applications has a Letter filter, and its Outcome cell shows the letter status.
                    The letter template Preview shows the variables as their names (preview-pdf is not used).
        Comms:      lib/emails.ts, module "communications". /communications (pages/Communications.tsx): every
                    email to a student with status chips (Sending / Sent / Retrying / Failed), tries, last
                    error and Retry Now. pages/EmailView.tsx shows an email as sent (sanitized; the branded
                    layout in a sandboxed frame, EmailFrame, as the mail app shows it) and holds
                    SendEmailForm: Send Email on an approved letter (Letters, the letter view, the
                    application's Letter card), with the program's email template or one picked (required
                    for a Manual Review letter). The application page has an Emails card
                    (pages/ApplicationEmails.tsx). The bell's failed emails open ?status=failed.
        Roles:      a customized role has Reset to Defaults (POST /roles/:id/permissions/reset).
        Decisions:  Manual Review "Review" opens pages/ReviewDrawer.tsx: the case, the latest run with a
                    Met / Not met override per criterion (with a note; doesn't decide), notes, and Approve /
                    Reject with a reason (preselected from suggestedOutcome). A resolved case opens read only.
                    A decided application has Change Outcome (pages/ChangeOutcomeForm.tsx) and shows who
                    decided (AI, or a person with the reason).
        Activity:   pages/ApplicationActivity.tsx, the application's whole history, 10 at a time (API max 100).
        Reports:    pages/Reports.tsx (Applications read): KPIs, charts, By Program, and Export CSV through
                    the API client as a blob (lib/reports.ts; the file name is built here, CORS hides the header).
        Eligibility: sets as cards (pages/EligibilityCriteria.tsx); a set on its own page
                    (/eligibility-criteria/:id, pages/EligibilitySetDetail.tsx): a banner for the shown
                    version (draft: Publish / Discard / Duplicate From; live: New Version), then tabs
                    Rules (cards grouped by category) / Documents / Programs / Versions. ?version= and ?tab=
                    are in the URL.
        Audit Log:  values read like the app: dates formatted, user ids ("assignedBy") as names, secrets
                    (password, OpenAI key, SMTP password) only as "added / changed / removed".
        Applications: list (pages/Applications.tsx), wizard (pages/NewApplication.tsx: steps 1-2 stay in
                    the form, Next on step 2 creates the draft, URL becomes /applications/:id/edit), detail
                    (pages/ApplicationDetail.tsx). Files: multipart upload, download via a fresh 5-minute
                    link each time (lib/applications.ts). A submitted application is locked.
                    The detail page starts with where it stands (pages/ApplicationJourney.tsx): the journey
                    Submitted → AI Assessment → Decision → Letter → Emailed, and one Next Step with a button
                    to the right tab or page; then tabs (?tab=) Overview / Assessment / Documents /
                    Letter & Emails / Notes / Activity. Panels stay mounted so a running assessment updates.
        Manual Review: review cases from /reviews (lib/reviews.ts, module "reviews": read to see, update
                    for every action). Assign / Request Documents / Return for Reassessment in
                    pages/ManualReviewDialogs.tsx; a document request is recorded even if the email fails.
        Dashboard:  one call, GET /dashboard (lib/dashboard.ts). Counts not built yet come as null and
                    show "—", never 0.
                    Stats pages (Dashboard, AI Usage) share components/PeriodFilter (presets + a custom
                    range, no future dates, max 366 days), StatsPageSkeleton and, from pages/DashboardWidgets,
                    KpiCard / WidgetCard / BarList; charts over time use components/TrendChart (a bar per
                    day up to ~6 weeks, per week up to ~6 months, else per month; y-axis, peak label, tooltips).
        AI Usage:   read only, module "ai_usage" (lib/aiUsage.ts): GET /ai-usage/summary + GET /ai-usage with the
                    same filters. Cost is USD (formatUsd: up to 4 decimals); costUsd null = no price yet, show
                    "—" and "some costs unknown". Model prices come with GET /settings/options.
                    Every error / status screen is components/StatusScreen (one look: drawing, tag, title, message,
                    actions): full screen for the error page, 404 and a failed start (AppLoader); `inline` (a card)
                    for a page the role can't open (NotAllowed) and a record that is missing / forbidden / failed
                    (RecordUnavailable, with the way back to its list). Drawings in components/Illustrations.
                    Firmli staff (a Super Admin of the platform tenant: isFirmliSuperAdmin): "Switch tenant / user" in the header menu
                    (components/StaffSwitcher.tsx, /dev/users + /dev/switch-user, active users only). A switch
                    gives the browser (its cookie, every tab) that user's session; the API does not say so,
                    so the staff member's name is kept in localStorage ("switchedFrom"). While switched, the
                    header shows Back to Firmli (POST /auth/switch-back: the staff member's own session
                    again), switching again and Platform Admin wait until then, and My Profile hides
                    Edit Name / Change Password / Log Out of All Devices.
                    Platform Admin (/platform, pages/Platform.tsx, lib/platform.ts; "Platform Admin" in the user
                    menu): client tenants with New Tenant (+ first Super Admin), Edit, Block / Unblock, Remove
                    (type the name), and a tenant drawer with its users and Add User.
                    Send by Email uses POST /platform/tenants/:id/users/:userId/send-credentials.
                    A blocked tenant's users land on login with "Your institution's account is blocked".
        Error codes: lib/api.ts decides a 401 by the error's `code` (lib/errors.ts getErrorCode), never
                    its text: TENANT_BLOCKED, ACCOUNT_NOT_ACTIVE (the API's message is kept in
                    sessionStorage for the login page, not the URL), SESSION_ENDED = refresh once, then log in.
        Dropdowns:  lib/dropdowns.ts useDropdown(name, params): GET /dropdowns/<name> ({value, label}, no
                    page limit, no module permission). Program filters, New Application, Assign Programs,
                    the program form's campus / set / template selects (drafts marked) and Send Email use
                    it. Cached under the module's key, so saving a program, campus or template refreshes it.
                    Officers and reviewers stay on their module's options (who may take a case). The user form
                    picks the role from /dropdowns/roles (no Roles read needed; Super Admin disabled for others).
        From the API, not the frontend: a module's actions (GET /auth/me `modules`, Profile's Your
                    Access), a role's userCount (GET /roles), user names in changes (fromName / toName,
                    Audit Log and Activity), and the logo in a branded email's bodyHtml.
        Colors:     never a hex value outside theme.ts. Use color="primary" / "red" / ... or the
                    --firmli-* CSS variables (cssVar("divider") in TS). Buttons: variant primary
                    (default), secondary, tertiary, danger.
        Enums:      send the API's snake_case values ("full_time"); map them to labels in the UI.
        Dates:      formatDate() from lib/utils.ts ("31 Dec 2026").
        State:      server data lives in react-query; UI state in useState / Mantine hooks.
        Tests:      npm test. Pure logic runs in node; a component test starts with `// @vitest-environment jsdom`.

Happy Coding :-)
