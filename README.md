# 967 Initiative / مبادرة 967

> **ابدأ من هنا:** [الدليل الشامل للمشروع — كيف يعمل الموقع، والخدمات المرتبطة، وطريقة العمل المفضلة](PROJECT_GUIDE_AR.md). هذا هو المرجع الأول لأي شخص جديد سيعمل على الموقع.

> **تنبيه بتاريخ 26 أكتوبر 2026:** ملفات SQL ذات التواريخ القديمة المذكورة هنا موجودة في أرشيف للرجوع إليها وللاختبارات التاريخية؛ ليست ترحيلات نشطة، ولا تُشغَّل على إنتاج 967. الـBaseline الحالي المرشح هو `supabase/migrations/20261026215718_remote_schema.sql` ولم تُسوَّ حالته في سجل الإنتاج بعد.

الموقع الرسمي لمبادرة 967: مبادرة إعلامية ومجتمعية يمنية.

مراجعة إصلاحات ما قبل الإطلاق الحالية: [التقرير العربي وسجل البنود الـ34](docs/audit/prelaunch-fixes-2026-10/README_AR.md)، مع الاختبارات والأدلة ومتطلبات الترحيل. القرار المحلي READY FOR REVIEW؛ لم تُطبق migrations أو تُنشر التغييرات على الإنتاج.

### التحرير والإشراف أثناء التصفح

أُضيف وضع تحرير للمسؤولين في الصفحات العامة مع مراجعة المناظرات وتحرير المحتوى وربط المهام بالنظام الحالي. راجع [دليل التشغيل وSQL](docs/inline-editor/README.md) و[تقرير التنفيذ والتحقق](docs/inline-editor/verification.md). يحتاج الحفظ الجديد إلى migration مستقلة، ولم تُطبق على الإنتاج ولم تُنشر الميزة تلقائياً.

### مناظرات 967

قسم المناظرات متاح في `/debates`، وحساب المستخدم في `/account`، وإدارة المناظرات في `/admin/debates` عبر صلاحيات التحرير الحالية. راجع [دليل التثبيت والتشغيل](docs/debates/README.md) و[تقرير التحقق](docs/debates/verification.md) قبل التفعيل. يجب تطبيق Migration المناظرات واختبار تأكيد البريد وSMTP وRLS في مشروع Supabase معزول أولاً. لم تُطبّق تغييرات على الإنتاج ولم يُنشر الموقع تلقائياً.

### مراجعة الإطلاق — أكتوبر 2026

نتائج المراجعة والقيود التشغيلية وخطوات التحقق قبل النشر في [تقرير الجاهزية النهائي](docs/audit/final-readiness-report.md)، مع [قائمة المسارات](docs/audit/route-inventory.md) وتقارير [SEO والذكاء الاصطناعي](docs/audit/seo-ai-report.md) و[تجربة الاستخدام](docs/audit/ux-qa-report.md) و[الهندسة والأمن](docs/audit/engineering-security-report.md). التعديلات المحلية لا تعني أنها منشورة. ملف `supabase/launch-hardening-proposed.sql` مقترح للمراجعة والاختبار في قاعدة معزولة؛ لم يُطبّق على الإنتاج.

### تطوير تجربة المنصة

يمكن تعديل مقدمة الرئيسية وقسم «عن المبادرة» والترويسة والتذييل وروابط التواصل من لوحة التحرير ← الإعدادات. راجع [دليل إعدادات محتوى الموقع](docs/site-settings.md).

الهوية الجديدة ونظام التنقل والبحث العربي الموحد والمشاركة والأدلة والمرصد موثقة في [تقرير إعادة التصميم](docs/redesign-report.md)، مع نتائج الاختبارات والخطوات اللازمة قبل النشر. البحث العام على `/search`، والمساهمات على `/contribute`. شغّل `npm test` لاختبارات البيانات والبحث، و`node scripts/check-routes.mjs` لفحص HTTP بعد تشغيل الموقع محلياً.

### Features

- Arabic first, RTL, responsive editorial design.
- Home, media works, magazine, statistics and timeline, interactive Yemen map, figures, product and professional directories, global Arabic search, and contributions.
- Magazine archive, individual issue links, built-in PDF.js reader with single/spread pages, search, zoom and download.
- Works library searchable by platform, theme and text.
- Contact form saved to database via server-side API.
- Protected `/admin` for approved editors: email/password sign-in, add works, upload PDFs and cover images, publish/unpublish, see messages and delete entries.
- Supabase Row Level Security, constrained storage uploads, draft/published segregation.
- OpenGraph SEO, robots and sitemap.

## 1. Local setup

Requirements: Node.js 22.13+ on the 22.x line, or Node.js 24+ and npm. Validation used Node.js 24.18.0. PDF.js and Supabase require the updated runtime. Run:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Browse http://localhost:3000. **Without Supabase configured**, the site works in demonstration mode with an explicitly labeled sample magazine PDF and example media cards; message submission and CMS require credentials. This is intentional, to avoid fabricated published content.

## 2. Database and admin access

The current project uses the ordered files in `supabase/migrations/`. Do not run `supabase/schema.sql`, archived migrations, or top-level SQL files against the existing production project. Follow [the comprehensive Arabic guide](PROJECT_GUIDE_AR.md#11-supabase-قاعدة-البيانات-والمصادقة-والتخزين), inspect the actual migration history, and test every database change in an isolated project first.

For authorized local development, copy the test project's URL, publishable/anon key, and server-only service-role key into `.env.local` as specified by `.env.example`. Apply the active migrations through the reviewed Supabase migration workflow, configure Auth/SMTP and exact redirect URLs, then use a dedicated test account with an explicit `admin` or `management` record in `editors`. Production roles and migrations require separate approval; the application never creates or promotes an editor automatically.

Restart the local server and use `/admin` after the test account and database are ready. Publish only reviewed, real content; demo material must remain explicitly labelled.

**Security:** Never put `.env.local` in Git. The service role key can bypass database RLS and must remain server-only. Only named users in `editors` can edit content. The public storage bucket is appropriate for **published, non-confidential** PDF files/images; uploaded draft files are still publicly accessible if their URL is known. Don't upload confidential drafts there.

## 3. Contact form

The contact form writes to the `messages` table server-side; editors can view and follow up messages inside `/admin`. Before deploying this version, review and test `supabase/archive/legacy-migrations/202610230001_prelaunch_roles_rls.sql`, `202610230002_management_guard.sql`, and `202610230003_contact_workflow.sql` in an isolated database. The contact endpoint fails safely with 503 until its shared PostgreSQL limiter is installed. It allows eight valid attempts per ten minutes per HMAC network digest across server instances; raw IP addresses are never stored. Vercel's overwritten `x-vercel-forwarded-for` is used only when `VERCEL=1`; other hosts share an unattributed limit until a trusted adapter is configured. An optional server-only `CONTACT_RATE_LIMIT_SECRET` separates the HMAC key from the existing service-role key. Expired digests are removed by the next valid request; a quiet database retains expired hashes until then.

In production, create a Cloudflare Turnstile widget for your deployment hostname and set both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Server validation checks success, the hostname from `NEXT_PUBLIC_SITE_URL`, and the `contact` action. Preview deployments must use their own site URL/widget configuration. CAPTCHA remains optional; its real external challenge has not been verified by local tests. Message follow-up statuses do not send email or external notifications. See [the security evidence and deployment limits](docs/audit/prelaunch-fixes-2026-10/security-notes.md).

## 4. Customize

- Name, initiative text, platform links, optional email: `lib/config.js`.
- Colors, font, responsive styles: `app/globals.css`.
- Main page content: `app/page.jsx`.
- Cover illustration, replace with final branding: `public/images/demo-cover.svg`.
- Demo PDF is deliberately labeled as an example: `public/demo/967-demo.pdf`.
- Domain: `NEXT_PUBLIC_SITE_URL` in hosting environment.

Empty platform links intentionally do not show social links; fill verified platform URLs before launching. Current Instagram link: https://www.instagram.com/yemen967_/.

## 5. GitHub + deployment

The repository lives at `https://github.com/WadhahEssam/967-initiative` (it moved from `AihamAnter/967-initiative` in November 2026; the old repository is read-only history). Work on a focused branch, run the required checks, and open a pull request to `main`. Production `https://967ye.com` runs on Coolify and deploys automatically on every push to `main` of this repository, so merging a pull request deploys production; check the Coolify deployment and `https://967ye.com` after merging. See [the GitHub, CI, and deployment workflow](PROJECT_GUIDE_AR.md#13-github-وci-والنشر).

## Editorial responsibility

All program descriptions are drafts for the initiative's own review. The media cards and PDF currently labelled **DEMO** are not claims that activities have taken place. Confirm public mission wording, logo, privacy/contact policy and platform accounts before publishing.

## Notes

- Run `npm run build` after installing dependencies. A GitHub Actions workflow also checks builds on push. The provided archive contains source only; dependencies are not bundled.
- The editor dashboard supports creating, editing, publishing/unpublishing and deleting works and issues.
- A PDF with text as selectable text is needed for reliable in-reader keyword search; scanned/image-only PDFs generally won't be searchable.
- IBM Plex Sans Arabic is self-hosted in `public/fonts/`, with its SIL Open Font License and source manifest. Fallback system fonts are available when offline.

### Repeat the launch checks

Run `npm test`, `npm run lint`, and `npm run build`, then `npm start`. On Windows PowerShell use `npm.cmd` if execution policy blocks the `npm.ps1` shim. Against the running local production build:

```bash
node tests/seo-http.mjs
node tests/security-http.mjs
node scripts/audit-routes.mjs
node scripts/check-search.mjs
```

`security-http.mjs` sends invalid local requests only. Browser QA tooling is optional and isolated from production dependencies:

```bash
npm install --prefix .audit-tools --no-package-lock playwright @axe-core/playwright lighthouse
node scripts/audit-browser.mjs
node scripts/audit-filters.mjs
```

Set `AUDIT_CHROME_PATH` to an installed Chromium executable and `CHECK_BASE_URL` if using another local port. Install Chromium through the official Playwright CLI if needed. The browser script mocks contact success/failure and never verifies actual message persistence. Signed-in CMS CRUD, role changes, uploads, email delivery and real CAPTCHA must be verified in a separate test environment before launch. Do not run seed scripts or apply SQL to production as part of read-only checks.

Production runs on `https://967ye.com`, which is also the canonical default in `lib/seo.js`; set `NEXT_PUBLIC_SITE_URL` only to override it. Preview/development deployments stay noindex. Keep loading boundaries at leaf routes: wrapping missing dynamic records in an ancestor streaming fallback sends HTTP 200 before `notFound()` can return 404. PDF/map/chart loading and retry states remain in their client components.

### Work detail / embedded video viewer

Each published work now opens at `/works/[slug]`. The library cards are accessible links, and public embeds for YouTube (including Shorts), Instagram posts/Reels, TikTok, Vimeo, supported Facebook video links, and direct MP4 files are attempted via allowlisted providers. Videos load only when the visitor opts to play, and there is always a link to the source. When a platform blocks embedding or a URL is not recognised, the external source link remains available. No DB migration required.

### Yemen ranking

`/yemen-ranking` provides 39 published indicators across 11 fields, same-year world/Arab rankings, Yemen's nearby countries/economies, history, country comparison, share links and PNG/CSV exports. A 40th literacy preset stays unpublished because the bundled period has no Yemen observation. World Bank source attribution and observation years travel with each local snapshot. Refresh local files with `npm run data:rankings`; this never writes to Supabase.

Editorial controls live in the “ترتيب اليمن” admin tab. Persistent editing requires reviewed application of `supabase/yemen-ranking.sql` and initialization with `supabase/yemen-ranking-seed.sql`. Neither has been applied by this task. An uninitialized table with zero rows serves the bundled catalog and snapshots read-only; the editor shows setup instructions. Once editorial rows exist, the database controls the catalog, including hiding every metric. Exact shipped slug/code pairs can use bundled snapshots after initialization. See [the Arabic operating guide](docs/yemen-ranking.md) for controls, permissions, setup and test limits.
