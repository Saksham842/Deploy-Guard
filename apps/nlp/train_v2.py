"""
DeployGuard NLP Classifier v2 -- Training Script
Uses sentence-transformers/all-MiniLM-L6-v2 for semantic embeddings
Run: python train_v2.py
Produces: model_v2.pkl
"""
import sys
import io
# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError)
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import json
import pickle
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.preprocessing import LabelEncoder

try:
    from sentence_transformers import SentenceTransformer
    HAVE_ST = True
except ImportError:
    HAVE_ST = False
    print("[WARN] sentence-transformers not installed -- falling back to TF-IDF")

# ── EXPANDED DATASET ──────────────────────────────────────────────────────────
# Classes: bundle_size | query_regression | latency_spike | dependency_bloat
#          new_dependency | asset_added | feature | refactor | chore | unknown
# Minimum 40 examples per class

DATASET = [
    # ── bundle_size (50 examples) ─────────────────────────────────────────────
    {"text": "add new UI library for charts",                                    "label": "bundle_size"},
    {"text": "install react-pdf for document rendering",                         "label": "bundle_size"},
    {"text": "upgrade webpack to v5",                                            "label": "bundle_size"},
    {"text": "add framer motion animation library",                              "label": "bundle_size"},
    {"text": "install lodash and moment js",                                     "label": "bundle_size"},
    {"text": "add video player component",                                       "label": "bundle_size"},
    {"text": "new image carousel with dependencies",                             "label": "bundle_size"},
    {"text": "install d3 for visualizations",                                    "label": "bundle_size"},
    {"text": "add three.js for 3d effects",                                      "label": "bundle_size"},
    {"text": "upgrade next.js to latest version",                                "label": "bundle_size"},
    {"text": "add new npm package for pdf export",                               "label": "bundle_size"},
    {"text": "install chart.js and wrapper library",                             "label": "bundle_size"},
    {"text": "added heavy analytics sdk to frontend",                            "label": "bundle_size"},
    {"text": "include full polyfill bundle for ie11",                            "label": "bundle_size"},
    {"text": "add react-virtualized for large lists",                            "label": "bundle_size"},
    {"text": "bundle size increased after adding mapbox gl",                     "label": "bundle_size"},
    {"text": "import entire lodash instead of lodash/pick",                      "label": "bundle_size"},
    {"text": "add moment locale files for all languages",                        "label": "bundle_size"},
    {"text": "install full bootstrap css framework",                             "label": "bundle_size"},
    {"text": "add video.js player with all plugins",                             "label": "bundle_size"},
    {"text": "install tensorflow.js model in browser",                           "label": "bundle_size"},
    {"text": "add fullcalendar library with all views",                          "label": "bundle_size"},
    {"text": "include google maps api and clustering plugin",                    "label": "bundle_size"},
    {"text": "add rich text editor (quill) with all modules",                   "label": "bundle_size"},
    {"text": "install react-spring and react-use-gesture",                      "label": "bundle_size"},
    {"text": "add pdf.js for in-browser pdf preview",                            "label": "bundle_size"},
    {"text": "include firebase sdk with all modules",                            "label": "bundle_size"},
    {"text": "add aws amplify library to frontend",                              "label": "bundle_size"},
    {"text": "install monaco editor for code editing",                           "label": "bundle_size"},
    {"text": "add ant design component library",                                 "label": "bundle_size"},
    {"text": "install material ui with all icons",                               "label": "bundle_size"},
    {"text": "add recharts library for analytics dashboard",                     "label": "bundle_size"},
    {"text": "include highlight.js with all languages",                          "label": "bundle_size"},
    {"text": "add react-player for multimedia embedding",                        "label": "bundle_size"},
    {"text": "install i18next with all locale packages",                         "label": "bundle_size"},
    {"text": "added @emotion/styled which inflated css-in-js bundle",           "label": "bundle_size"},
    {"text": "import axios instead of native fetch",                             "label": "bundle_size"},
    {"text": "add echarts for enterprise charting",                              "label": "bundle_size"},
    {"text": "install react-select with all dependencies",                       "label": "bundle_size"},
    {"text": "added styled-components to replace css modules",                   "label": "bundle_size"},
    {"text": "include entire rxjs library",                                      "label": "bundle_size"},
    {"text": "add nivo charts replacing lightweight alternative",                "label": "bundle_size"},
    {"text": "bundle grew after adding shopify polaris",                         "label": "bundle_size"},
    {"text": "install ag-grid community with all features",                      "label": "bundle_size"},
    {"text": "added swiper.js for mobile carousel support",                      "label": "bundle_size"},
    {"text": "include gsap animation library full build",                        "label": "bundle_size"},
    {"text": "add draft.js rich editor to form",                                 "label": "bundle_size"},
    {"text": "install vega-lite for declarative charts",                         "label": "bundle_size"},
    {"text": "added semantic-ui-react replacing custom components",              "label": "bundle_size"},
    {"text": "webpack chunk size exceeded after new package",                    "label": "bundle_size"},

    # ── query_regression (50 examples) ───────────────────────────────────────
    {"text": "add eager loading for user relations",                             "label": "query_regression"},
    {"text": "fetch all posts without pagination",                               "label": "query_regression"},
    {"text": "add nested include for all associations",                          "label": "query_regression"},
    {"text": "removed limit clause from query",                                  "label": "query_regression"},
    {"text": "added join without index on foreign key",                          "label": "query_regression"},
    {"text": "select star from large table",                                     "label": "query_regression"},
    {"text": "loop with individual db calls inside",                             "label": "query_regression"},
    {"text": "n plus one query in user feed",                                    "label": "query_regression"},
    {"text": "missing database index on search column",                          "label": "query_regression"},
    {"text": "full table scan in report generation",                             "label": "query_regression"},
    {"text": "removed caching for database queries",                             "label": "query_regression"},
    {"text": "sequential db lookups in loop instead of batch",                   "label": "query_regression"},
    {"text": "fetch user with all nested comments and replies",                  "label": "query_regression"},
    {"text": "unindexed order by on timestamp column",                           "label": "query_regression"},
    {"text": "count without index causing slow aggregation",                     "label": "query_regression"},
    {"text": "removed query result caching layer",                               "label": "query_regression"},
    {"text": "n+1 query introduced in graphql resolver",                         "label": "query_regression"},
    {"text": "load entire product catalog into memory",                          "label": "query_regression"},
    {"text": "added like query on unindexed column",                             "label": "query_regression"},
    {"text": "slow orm query due to missing include optimization",               "label": "query_regression"},
    {"text": "fetch related records one by one in for loop",                     "label": "query_regression"},
    {"text": "unoptimized group by without composite index",                     "label": "query_regression"},
    {"text": "query without where clause on large table",                        "label": "query_regression"},
    {"text": "removed redis cache for session lookups",                          "label": "query_regression"},
    {"text": "repeated db call for same data in render",                         "label": "query_regression"},
    {"text": "multiple round trips instead of single join",                      "label": "query_regression"},
    {"text": "cartesian product query from missing join condition",              "label": "query_regression"},
    {"text": "no pagination on admin list endpoint",                             "label": "query_regression"},
    {"text": "subquery in select clause inside loop",                            "label": "query_regression"},
    {"text": "added order by rand() on production query",                        "label": "query_regression"},
    {"text": "missing composite index for frequent query pattern",               "label": "query_regression"},
    {"text": "count(*) without limit on billion row table",                      "label": "query_regression"},
    {"text": "sequelize findAll without limit on users table",                   "label": "query_regression"},
    {"text": "prisma include all nested relations",                              "label": "query_regression"},
    {"text": "mongoose populate with deep nesting",                              "label": "query_regression"},
    {"text": "removed query explain from slow query detector",                   "label": "query_regression"},
    {"text": "typeorm lazy loading all relations",                                "label": "query_regression"},
    {"text": "hibernate n+1 select for order items",                             "label": "query_regression"},
    {"text": "added correlated subquery to list view",                           "label": "query_regression"},
    {"text": "unindexed text search on description column",                      "label": "query_regression"},
    {"text": "slow distinct query without proper index",                         "label": "query_regression"},
    {"text": "sequential scan replacing index scan",                             "label": "query_regression"},
    {"text": "fetch user permissions on every request without cache",            "label": "query_regression"},
    {"text": "load dashboard data in single massive query",                      "label": "query_regression"},
    {"text": "join across 5 tables without proper indexes",                      "label": "query_regression"},
    {"text": "slow analytics query scanning all rows",                           "label": "query_regression"},
    {"text": "removed pagination from search results api",                       "label": "query_regression"},
    {"text": "added unindexed filter on large events table",                     "label": "query_regression"},
    {"text": "nested loop join replacing hash join",                             "label": "query_regression"},
    {"text": "db query inside handlebars template loop",                         "label": "query_regression"},

    # ── latency_spike (50 examples) ───────────────────────────────────────────
    {"text": "added synchronous file read in request handler",                   "label": "latency_spike"},
    {"text": "blocking sleep in middleware",                                      "label": "latency_spike"},
    {"text": "added external api call without timeout",                          "label": "latency_spike"},
    {"text": "cpu intensive computation in main thread",                         "label": "latency_spike"},
    {"text": "large json serialization on every request",                        "label": "latency_spike"},
    {"text": "added bcrypt rounds from 10 to 14",                                "label": "latency_spike"},
    {"text": "image resize on upload without queue",                             "label": "latency_spike"},
    {"text": "synchronous dns lookup in express middleware",                     "label": "latency_spike"},
    {"text": "blocking crypto operation on request thread",                      "label": "latency_spike"},
    {"text": "added regex with catastrophic backtracking",                       "label": "latency_spike"},
    {"text": "large file read synchronously before response",                    "label": "latency_spike"},
    {"text": "heavy computation without worker thread",                          "label": "latency_spike"},
    {"text": "synchronous redis call blocking event loop",                       "label": "latency_spike"},
    {"text": "added puppeteer screenshot in request path",                       "label": "latency_spike"},
    {"text": "video transcoding in web server process",                          "label": "latency_spike"},
    {"text": "xml parsing 100mb file per request",                               "label": "latency_spike"},
    {"text": "blocking network call before cache check",                         "label": "latency_spike"},
    {"text": "added slow third-party analytics sdk",                             "label": "latency_spike"},
    {"text": "zip file creation on main thread",                                 "label": "latency_spike"},
    {"text": "synchronous email send in checkout flow",                          "label": "latency_spike"},
    {"text": "added rate limiter with redis blocking call",                      "label": "latency_spike"},
    {"text": "heavy markdown parsing on each page load",                         "label": "latency_spike"},
    {"text": "synchronous s3 upload before response",                            "label": "latency_spike"},
    {"text": "pdf generation blocking request completion",                       "label": "latency_spike"},
    {"text": "no timeout on external stripe webhook call",                       "label": "latency_spike"},
    {"text": "added deep object clone on hot path",                              "label": "latency_spike"},
    {"text": "expensive sorting algorithm in request handler",                   "label": "latency_spike"},
    {"text": "removed async processing for thumbnail generation",                "label": "latency_spike"},
    {"text": "synchronous file system write for logging",                        "label": "latency_spike"},
    {"text": "added excessive middleware chain to all routes",                   "label": "latency_spike"},
    {"text": "blocking loop calculating aggregations per request",               "label": "latency_spike"},
    {"text": "jwt verification done synchronously per route",                    "label": "latency_spike"},
    {"text": "added heavy linting step in api response",                         "label": "latency_spike"},
    {"text": "csv export without streaming causing memory spike",                "label": "latency_spike"},
    {"text": "wait for all promises sequentially instead of parallel",          "label": "latency_spike"},
    {"text": "synchronous hash comparison for session token",                    "label": "latency_spike"},
    {"text": "blocking file stat check in auth middleware",                      "label": "latency_spike"},
    {"text": "no connection pooling causing new db conn per request",           "label": "latency_spike"},
    {"text": "serialization of large nested object tree per request",           "label": "latency_spike"},
    {"text": "p99 latency jumped after adding validation middleware",           "label": "latency_spike"},
    {"text": "slow dns resolution with no cache on http client",                "label": "latency_spike"},
    {"text": "added synchronous xml rpc call in api route",                     "label": "latency_spike"},
    {"text": "heavy schema validation on every incoming request",               "label": "latency_spike"},
    {"text": "recursive object traversal on large payload",                     "label": "latency_spike"},
    {"text": "added gzip decompress step in hot middleware",                    "label": "latency_spike"},
    {"text": "response time p95 doubled after introducing new interceptor",     "label": "latency_spike"},
    {"text": "added slow ip geolocation lookup per request",                    "label": "latency_spike"},
    {"text": "running ffmpeg process per upload synchronously",                 "label": "latency_spike"},
    {"text": "deserializing large protobuf without streaming",                  "label": "latency_spike"},
    {"text": "high cpu usage from unoptimized template rendering",              "label": "latency_spike"},

    # ── dependency_bloat (50 examples) ────────────────────────────────────────
    {"text": "upgraded all dependencies to latest",                              "label": "dependency_bloat"},
    {"text": "bumped transitive dependency versions",                            "label": "dependency_bloat"},
    {"text": "npm audit fix force",                                              "label": "dependency_bloat"},
    {"text": "updated package lock file",                                        "label": "dependency_bloat"},
    {"text": "replaced library with heavier alternative",                        "label": "dependency_bloat"},
    {"text": "added polyfills for ie11 support",                                 "label": "dependency_bloat"},
    {"text": "installed unused peer dependencies",                               "label": "dependency_bloat"},
    {"text": "kept dev dependencies in production build",                        "label": "dependency_bloat"},
    {"text": "yarn upgrade causes major version bumps",                          "label": "dependency_bloat"},
    {"text": "npm dedupe introduced incompatible versions",                      "label": "dependency_bloat"},
    {"text": "transitive dependency pulled in legacy library",                   "label": "dependency_bloat"},
    {"text": "updated lock file after merging conflicting branches",             "label": "dependency_bloat"},
    {"text": "force install overrides security patch versions",                  "label": "dependency_bloat"},
    {"text": "dependency resolution now includes extra packages",                "label": "dependency_bloat"},
    {"text": "peer dependency installed multiple versions of react",             "label": "dependency_bloat"},
    {"text": "added optional dependency that is always loaded",                  "label": "dependency_bloat"},
    {"text": "migrated from yarn to npm causing resolution changes",             "label": "dependency_bloat"},
    {"text": "package hoisting changed after lockfile update",                   "label": "dependency_bloat"},
    {"text": "removed deduplicated packages from lockfile",                      "label": "dependency_bloat"},
    {"text": "added heavy runtime dependency for optional feature",             "label": "dependency_bloat"},
    {"text": "global npm install added to production image",                     "label": "dependency_bloat"},
    {"text": "included all optional peer deps in package.json",                  "label": "dependency_bloat"},
    {"text": "forced resolution of conflicting semver ranges",                   "label": "dependency_bloat"},
    {"text": "npm shrinkwrap updated with new indirect dependencies",            "label": "dependency_bloat"},
    {"text": "replaced lightweight lib with full-featured alternative",          "label": "dependency_bloat"},
    {"text": "installed deprecated package that pulls large chain",              "label": "dependency_bloat"},
    {"text": "switched from pnpm to npm changing tree structure",                "label": "dependency_bloat"},
    {"text": "yarn resolutions field introduced extra packages",                 "label": "dependency_bloat"},
    {"text": "package-lock now 3x larger after merge",                           "label": "dependency_bloat"},
    {"text": "added platform specific optional deps for all platforms",          "label": "dependency_bloat"},
    {"text": "installed full aws sdk instead of modular clients",                "label": "dependency_bloat"},
    {"text": "npm install --legacy-peer-deps caused version tree changes",      "label": "dependency_bloat"},
    {"text": "workspace hoisting now includes all devDeps",                      "label": "dependency_bloat"},
    {"text": "added unnecessary polyfill packages for modern browsers",          "label": "dependency_bloat"},
    {"text": "replaced single-purpose lib with swiss army knife library",        "label": "dependency_bloat"},
    {"text": "npm ci restoring packages with newer sub-dependencies",           "label": "dependency_bloat"},
    {"text": "installed multiple conflicting versions of same utility",          "label": "dependency_bloat"},
    {"text": "pnpm audit created new overrides pulling extra deps",             "label": "dependency_bloat"},
    {"text": "transitive peer dependency conflict resolved by duplication",      "label": "dependency_bloat"},
    {"text": "bumped react to v19 pulling in new concurrent deps",              "label": "dependency_bloat"},
    {"text": "upgraded prisma causing new binary downloads",                     "label": "dependency_bloat"},
    {"text": "installed native node module with optional pre-builds",           "label": "dependency_bloat"},
    {"text": "added babel plugin that requires heavy preset chain",             "label": "dependency_bloat"},
    {"text": "esbuild peer dep version mismatch causing duplicate installs",    "label": "dependency_bloat"},
    {"text": "added graphql sdk that bundles its own query parser",             "label": "dependency_bloat"},
    {"text": "docker image size grew due to new npm packages",                  "label": "dependency_bloat"},
    {"text": "yarn pnp disabled requiring more node_modules entries",           "label": "dependency_bloat"},
    {"text": "added nx plugin that installs extra workspace tooling",           "label": "dependency_bloat"},
    {"text": "lock file regenerated with incompatible resolution strategy",     "label": "dependency_bloat"},
    {"text": "direct dependency now transitively requires heavy packages",      "label": "dependency_bloat"},

    # ── new_dependency (40 examples) ─────────────────────────────────────────
    {"text": "add lodash for date formatting utilities",                         "label": "new_dependency"},
    {"text": "install react-query for server state caching",                    "label": "new_dependency"},
    {"text": "add date-fns package to replace moment",                          "label": "new_dependency"},
    {"text": "npm install axios for HTTP requests",                              "label": "new_dependency"},
    {"text": "add chart.js for data visualisation",                              "label": "new_dependency"},
    {"text": "install zod for runtime schema validation",                        "label": "new_dependency"},
    {"text": "install framer-motion for animations",                             "label": "new_dependency"},
    {"text": "add sharp for server-side image processing",                       "label": "new_dependency"},
    {"text": "install puppeteer for PDF generation",                             "label": "new_dependency"},
    {"text": "add aws-sdk for S3 file uploads",                                  "label": "new_dependency"},
    {"text": "install stripe for payment processing",                            "label": "new_dependency"},
    {"text": "add uuid package for generating unique IDs",                       "label": "new_dependency"},
    {"text": "install helmet for express security headers",                      "label": "new_dependency"},
    {"text": "add winston for structured logging",                               "label": "new_dependency"},
    {"text": "install nodemailer for transactional emails",                      "label": "new_dependency"},
    {"text": "add multer for multipart file upload handling",                    "label": "new_dependency"},
    {"text": "install jsonwebtoken for JWT authentication",                      "label": "new_dependency"},
    {"text": "add bcrypt for password hashing",                                  "label": "new_dependency"},
    {"text": "install socket.io for real-time websocket support",               "label": "new_dependency"},
    {"text": "add @sentry/node for error tracking",                              "label": "new_dependency"},
    {"text": "install pdfkit for PDF document generation",                       "label": "new_dependency"},
    {"text": "add xlsx for Excel file parsing and export",                       "label": "new_dependency"},
    {"text": "install node-cron for scheduled background jobs",                  "label": "new_dependency"},
    {"text": "add cheerio for HTML scraping and parsing",                        "label": "new_dependency"},
    {"text": "install marked for markdown to HTML conversion",                   "label": "new_dependency"},
    {"text": "add i18next for internationalisation support",                     "label": "new_dependency"},
    {"text": "install react-hook-form for form state management",               "label": "new_dependency"},
    {"text": "add zustand for lightweight global state",                         "label": "new_dependency"},
    {"text": "install immer for immutable state updates",                        "label": "new_dependency"},
    {"text": "add p-limit for concurrency control in async loops",              "label": "new_dependency"},
    {"text": "install execa for running child processes",                        "label": "new_dependency"},
    {"text": "add dayjs as a lighter moment.js replacement",                     "label": "new_dependency"},
    {"text": "install nanoid for compact unique ID generation",                  "label": "new_dependency"},
    {"text": "add validator.js for string validation helpers",                   "label": "new_dependency"},
    {"text": "install cross-env for cross-platform env variable setting",       "label": "new_dependency"},
    {"text": "add compression middleware to express",                            "label": "new_dependency"},
    {"text": "install dotenv-safe to enforce required env vars",                 "label": "new_dependency"},
    {"text": "add @tanstack/react-table for data grids",                         "label": "new_dependency"},
    {"text": "install react-router-dom for client side routing",                "label": "new_dependency"},
    {"text": "add typeorm as orm for database interactions",                     "label": "new_dependency"},

    # ── asset_added (40 examples) ─────────────────────────────────────────────
    {"text": "add hero background image to landing page",                        "label": "asset_added"},
    {"text": "include new Inter font files in public/fonts",                     "label": "asset_added"},
    {"text": "add product photos to public/images directory",                    "label": "asset_added"},
    {"text": "upload brand logo SVG to assets folder",                           "label": "asset_added"},
    {"text": "add illustration for empty state screen",                          "label": "asset_added"},
    {"text": "include video background for hero section",                        "label": "asset_added"},
    {"text": "add team member headshot photos",                                  "label": "asset_added"},
    {"text": "include app store badge images",                                   "label": "asset_added"},
    {"text": "add favicon and apple touch icons",                                "label": "asset_added"},
    {"text": "include social sharing preview image og:image",                    "label": "asset_added"},
    {"text": "add custom icon font icomoon",                                     "label": "asset_added"},
    {"text": "include high-res background textures",                             "label": "asset_added"},
    {"text": "add animated GIF for onboarding walkthrough",                      "label": "asset_added"},
    {"text": "include partner logo images on homepage",                          "label": "asset_added"},
    {"text": "add woff2 font files for custom typography",                       "label": "asset_added"},
    {"text": "include product screenshot for marketing page",                    "label": "asset_added"},
    {"text": "add PDF user manual to static assets",                             "label": "asset_added"},
    {"text": "include audio files for notification sounds",                      "label": "asset_added"},
    {"text": "add 3D model files for interactive viewer",                        "label": "asset_added"},
    {"text": "include Lottie animation JSON for loading screen",                 "label": "asset_added"},
    {"text": "add country flags sprite sheet",                                   "label": "asset_added"},
    {"text": "include dark mode illustration variants",                          "label": "asset_added"},
    {"text": "add certificate template PDF to downloads",                        "label": "asset_added"},
    {"text": "include map tile assets for offline support",                      "label": "asset_added"},
    {"text": "add emoji sprite sheet for chat feature",                          "label": "asset_added"},
    {"text": "include printable invoice PDF template",                           "label": "asset_added"},
    {"text": "add retina 2x image assets for homepage",                          "label": "asset_added"},
    {"text": "include WebP format images for performance",                       "label": "asset_added"},
    {"text": "add full-bleed background image for pricing page",                 "label": "asset_added"},
    {"text": "include icon pack for navigation sidebar",                         "label": "asset_added"},
    {"text": "add vector illustrations for error pages",                         "label": "asset_added"},
    {"text": "include splash screen assets for mobile app",                      "label": "asset_added"},
    {"text": "add promotional banner image to homepage",                         "label": "asset_added"},
    {"text": "include brand color swatch files",                                 "label": "asset_added"},
    {"text": "add loading spinner animation assets",                             "label": "asset_added"},
    {"text": "include tutorial video for onboarding",                            "label": "asset_added"},
    {"text": "add wireframe mockup images to docs",                              "label": "asset_added"},
    {"text": "include social media icon set svg sprites",                        "label": "asset_added"},
    {"text": "add background pattern svg to design system",                      "label": "asset_added"},
    {"text": "include certification badge images",                               "label": "asset_added"},

    # ── feature (40 examples) ─────────────────────────────────────────────────
    {"text": "implement user profile page with avatar upload",                   "label": "feature"},
    {"text": "build checkout flow with stripe integration",                      "label": "feature"},
    {"text": "add real-time notification system using websockets",               "label": "feature"},
    {"text": "implement dark mode toggle with localStorage persistence",         "label": "feature"},
    {"text": "add CSV export for analytics dashboard",                           "label": "feature"},
    {"text": "build admin panel for user management",                            "label": "feature"},
    {"text": "implement two-factor authentication via TOTP",                     "label": "feature"},
    {"text": "add team invitations via email",                                   "label": "feature"},
    {"text": "implement pagination for search results",                          "label": "feature"},
    {"text": "build drag-and-drop kanban board",                                 "label": "feature"},
    {"text": "add webhook delivery system for integrations",                     "label": "feature"},
    {"text": "implement full-text search with debounce",                         "label": "feature"},
    {"text": "add public API with rate limiting",                                "label": "feature"},
    {"text": "build onboarding wizard for new users",                            "label": "feature"},
    {"text": "implement audit log for admin actions",                            "label": "feature"},
    {"text": "add GitHub OAuth login option",                                    "label": "feature"},
    {"text": "implement subscription billing portal",                            "label": "feature"},
    {"text": "build comment thread system for documents",                        "label": "feature"},
    {"text": "add multi-language support i18n",                                  "label": "feature"},
    {"text": "implement keyboard shortcuts for power users",                     "label": "feature"},
    {"text": "add Slack notification integration",                               "label": "feature"},
    {"text": "build interactive chart dashboard with filters",                   "label": "feature"},
    {"text": "implement video upload and transcoding pipeline",                  "label": "feature"},
    {"text": "add global search with keyboard shortcut",                         "label": "feature"},
    {"text": "implement row-level security for multi-tenant data",               "label": "feature"},
    {"text": "build PDF invoice generation on checkout",                         "label": "feature"},
    {"text": "add geolocation-based currency selection",                         "label": "feature"},
    {"text": "implement infinite scroll for activity feed",                      "label": "feature"},
    {"text": "add QR code generation for sharing",                               "label": "feature"},
    {"text": "build email template editor with preview",                         "label": "feature"},
    {"text": "implement smart notifications with digest mode",                   "label": "feature"},
    {"text": "add bulk action support for table rows",                           "label": "feature"},
    {"text": "implement role-based access control RBAC",                         "label": "feature"},
    {"text": "build integration with Jira for issue sync",                       "label": "feature"},
    {"text": "add user activity heatmap to analytics",                           "label": "feature"},
    {"text": "implement granular permission settings per repo",                  "label": "feature"},
    {"text": "build report scheduling and email delivery",                       "label": "feature"},
    {"text": "add typing indicators to chat interface",                          "label": "feature"},
    {"text": "implement SSO via SAML 2.0",                                       "label": "feature"},
    {"text": "build custom domain support for white-label accounts",             "label": "feature"},

    # ── refactor (40 examples) ────────────────────────────────────────────────
    {"text": "refactor auth middleware to use async await throughout",           "label": "refactor"},
    {"text": "extract shared utility functions to helpers",                      "label": "refactor"},
    {"text": "split monolithic UserController into smaller controllers",         "label": "refactor"},
    {"text": "replace callback-based DB queries with async await",               "label": "refactor"},
    {"text": "migrate API routes from express to fastify",                       "label": "refactor"},
    {"text": "reorganise component folder structure by feature",                 "label": "refactor"},
    {"text": "convert class components to functional with hooks",                "label": "refactor"},
    {"text": "extract email logic into dedicated EmailService module",           "label": "refactor"},
    {"text": "remove dead code from payment processor integration",              "label": "refactor"},
    {"text": "simplify state management by removing redundant Redux slices",     "label": "refactor"},
    {"text": "move API constants to shared config file",                         "label": "refactor"},
    {"text": "replace hardcoded strings with i18n keys",                         "label": "refactor"},
    {"text": "decompose large App.tsx into smaller page components",             "label": "refactor"},
    {"text": "extract database connection into singleton module",                "label": "refactor"},
    {"text": "consolidate duplicate validation logic into shared schema",        "label": "refactor"},
    {"text": "switch from moment.js to native Date API",                         "label": "refactor"},
    {"text": "replace axios with native fetch in client code",                   "label": "refactor"},
    {"text": "refactor notification system to use observer pattern",             "label": "refactor"},
    {"text": "extract chart configuration into separate config files",           "label": "refactor"},
    {"text": "move business logic out of route handlers into services",          "label": "refactor"},
    {"text": "replace any types with proper TypeScript interfaces",              "label": "refactor"},
    {"text": "consolidate CSS variables and remove duplicates",                  "label": "refactor"},
    {"text": "convert CommonJS modules to ES modules throughout",                "label": "refactor"},
    {"text": "replace nested ternaries with clearer switch statements",          "label": "refactor"},
    {"text": "refactor test helpers to avoid code duplication",                  "label": "refactor"},
    {"text": "extract job queue logic from controllers into workers",            "label": "refactor"},
    {"text": "consolidate error handling into central middleware",               "label": "refactor"},
    {"text": "simplify useEffect dependencies across components",                "label": "refactor"},
    {"text": "replace promise chains with async await in services",              "label": "refactor"},
    {"text": "refactor data access layer to repository pattern",                 "label": "refactor"},
    {"text": "split large SQL queries into parameterised helper functions",      "label": "refactor"},
    {"text": "move shared types to packages types shared module",                "label": "refactor"},
    {"text": "replace string error codes with typed error classes",              "label": "refactor"},
    {"text": "extract authentication token logic to dedicated hook",             "label": "refactor"},
    {"text": "reorganise imports to match eslint import order rule",             "label": "refactor"},
    {"text": "clean up redundant event listener registrations",                  "label": "refactor"},
    {"text": "merge duplicate api client initialization code",                   "label": "refactor"},
    {"text": "separate concerns in auth service",                                "label": "refactor"},
    {"text": "break up god object into smaller focused classes",                 "label": "refactor"},
    {"text": "extract reusable hook from component",                             "label": "refactor"},

    # ── chore (40 examples) ───────────────────────────────────────────────────
    {"text": "fix typo in README installation instructions",                     "label": "chore"},
    {"text": "update comments in auth middleware",                               "label": "chore"},
    {"text": "bump version to 1.2.0",                                            "label": "chore"},
    {"text": "update dependencies to latest patch versions",                     "label": "chore"},
    {"text": "add MIT license file",                                             "label": "chore"},
    {"text": "update .gitignore to exclude .DS_Store",                           "label": "chore"},
    {"text": "fix grammar in onboarding copy",                                   "label": "chore"},
    {"text": "update CHANGELOG for release",                                     "label": "chore"},
    {"text": "remove console.log statements from production code",               "label": "chore"},
    {"text": "update node version in .nvmrc",                                    "label": "chore"},
    {"text": "bump eslint rules to match team standard",                         "label": "chore"},
    {"text": "update Docker base image to node 20 alpine",                       "label": "chore"},
    {"text": "add missing semicolons prettier autofix",                          "label": "chore"},
    {"text": "fix spelling error in error message string",                       "label": "chore"},
    {"text": "remove unused import in dashboard component",                      "label": "chore"},
    {"text": "update README badges and shields",                                 "label": "chore"},
    {"text": "format code with prettier",                                        "label": "chore"},
    {"text": "update .editorconfig to enforce 2-space indent",                   "label": "chore"},
    {"text": "fix broken link in documentation",                                 "label": "chore"},
    {"text": "update GitHub Actions node-version",                               "label": "chore"},
    {"text": "add codeowners file for review assignments",                       "label": "chore"},
    {"text": "clean up unused CSS variables from theme file",                    "label": "chore"},
    {"text": "update API documentation to reflect new endpoints",                "label": "chore"},
    {"text": "remove deprecated webpack config options",                         "label": "chore"},
    {"text": "update tsconfig to strict mode",                                   "label": "chore"},
    {"text": "fix env variable name in .env.example",                            "label": "chore"},
    {"text": "add .prettierrc configuration file",                               "label": "chore"},
    {"text": "update package-lock.json after merge conflict resolution",         "label": "chore"},
    {"text": "remove TODO comment that was already addressed",                   "label": "chore"},
    {"text": "fix linting errors flagged by CI",                                 "label": "chore"},
    {"text": "update copyright year in LICENSE",                                 "label": "chore"},
    {"text": "add missing test coverage annotation",                             "label": "chore"},
    {"text": "correct variable name in inline code comment",                     "label": "chore"},
    {"text": "rename file to match convention",                                  "label": "chore"},
    {"text": "update stale bot configuration",                                   "label": "chore"},
    {"text": "fix CI pipeline environment variable name",                        "label": "chore"},
    {"text": "add pr template for github",                                       "label": "chore"},
    {"text": "update dockerfile entrypoint comment",                             "label": "chore"},
    {"text": "add issue templates to .github folder",                            "label": "chore"},
    {"text": "correct indentation in config file",                               "label": "chore"},

    # ── unknown (30 examples) ─────────────────────────────────────────────────
    {"text": "wip",                                                              "label": "unknown"},
    {"text": "fix",                                                              "label": "unknown"},
    {"text": "update stuff",                                                     "label": "unknown"},
    {"text": "changes",                                                          "label": "unknown"},
    {"text": "asdfasdf",                                                         "label": "unknown"},
    {"text": "temp",                                                             "label": "unknown"},
    {"text": "testing 123",                                                      "label": "unknown"},
    {"text": "misc updates",                                                     "label": "unknown"},
    {"text": "more work",                                                        "label": "unknown"},
    {"text": "reverts",                                                          "label": "unknown"},
    {"text": "idk",                                                              "label": "unknown"},
    {"text": "commit",                                                           "label": "unknown"},
    {"text": "done",                                                             "label": "unknown"},
    {"text": "patch",                                                            "label": "unknown"},
    {"text": "hotfix",                                                           "label": "unknown"},
    {"text": "quick fix",                                                        "label": "unknown"},
    {"text": "oops",                                                             "label": "unknown"},
    {"text": "merge branch",                                                     "label": "unknown"},
    {"text": "progress",                                                         "label": "unknown"},
    {"text": "checkpoint",                                                       "label": "unknown"},
    {"text": "cleanup",                                                          "label": "unknown"},
    {"text": "addressing feedback",                                              "label": "unknown"},
    {"text": "x",                                                                "label": "unknown"},
    {"text": "hello",                                                            "label": "unknown"},
    {"text": ".",                                                                "label": "unknown"},
    {"text": "blah",                                                             "label": "unknown"},
    {"text": "test",                                                             "label": "unknown"},
    {"text": "asd",                                                              "label": "unknown"},
    {"text": "nope",                                                             "label": "unknown"},
    {"text": "random stuff",                                                     "label": "unknown"},
]


def train():
    global HAVE_ST

    texts  = [d["text"]  for d in DATASET]
    labels = [d["label"] for d in DATASET]

    n_classes = len(set(labels))
    print(f"📊 Dataset: {len(texts)} samples across {n_classes} classes")
    from collections import Counter
    dist = Counter(labels)
    for cls, cnt in sorted(dist.items()):
        print(f"   {cls:25s}: {cnt} examples")

    # ── Encode ────────────────────────────────────────────────────────────────
    if HAVE_ST:
        print("\n🤖 Loading sentence-transformers/all-MiniLM-L6-v2...")
        encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        print(f"✅ Encoder loaded. Encoding {len(texts)} samples...")
        X = encoder.encode(texts, show_progress_bar=True, batch_size=32)
        encoder_name = "sentence-transformers/all-MiniLM-L6-v2"
    else:
        print("\n⚠️  Using TF-IDF fallback (install sentence-transformers for better accuracy)")
        from sklearn.feature_extraction.text import TfidfVectorizer
        tfidf = TfidfVectorizer(ngram_range=(1, 3), max_features=5000, sublinear_tf=True)
        X = tfidf.fit_transform(texts).toarray()
        encoder = tfidf
        encoder_name = "tfidf-fallback"

    le = LabelEncoder()
    y  = le.fit_transform(labels)

    # ── Train / Test split ────────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = LogisticRegression(max_iter=2000, C=1.0, class_weight="balanced")
    clf.fit(X_train, y_train)

    # ── Cross-validation ──────────────────────────────────────────────────────
    cv_scores = cross_val_score(clf, X, y, cv=5, scoring="f1_macro")
    print(f"\n✅ Cross-Val F1 (macro): {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    # ── Detailed metrics ──────────────────────────────────────────────────────
    y_pred = clf.predict(X_test)
    print("\n📊 Classification Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))
    print("\n🔢 Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    # ── Save ──────────────────────────────────────────────────────────────────
    model_data = {
        "encoder_name": encoder_name,
        "encoder":      encoder if HAVE_ST else None,
        "tfidf":        encoder if not HAVE_ST else None,
        "classifier":   clf,
        "label_encoder": le,
        "classes":      le.classes_.tolist(),
        "n_samples":    len(texts),
        "cv_f1":        float(cv_scores.mean()),
        "cv_f1_std":    float(cv_scores.std()),
        "use_sentence_transformers": HAVE_ST,
    }

    import os
    out_path = os.path.join(os.path.dirname(__file__), "model_v2.pkl")
    with open(out_path, "wb") as f:
        pickle.dump(model_data, f)
    print(f"\n✅ Model saved → {out_path}")
    print(f"   Classes: {le.classes_.tolist()}")
    print(f"   CV F1 macro: {cv_scores.mean():.3f}")


if __name__ == "__main__":
    train()
