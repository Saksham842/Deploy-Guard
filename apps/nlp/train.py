"""
DeployGuard NLP Classifier — Training Script
Run: python train.py
Produces: commit_classifier.joblib + commit_vectorizer.joblib
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
import joblib
import numpy as np

# ─── 200 high-quality labelled examples ──────────────────────────────────────
# Categories: new_dependency | asset_added | feature | refactor | chore | unknown

TRAINING_DATA = [
    # ── new_dependency (38 examples) ─────────────────────────────────────────
    ("add lodash for date formatting utilities",                     "new_dependency"),
    ("install react-query for server state caching",                 "new_dependency"),
    ("add date-fns package to replace moment",                       "new_dependency"),
    ("npm install axios for HTTP requests",                          "new_dependency"),
    ("add chart.js for data visualisation",                          "new_dependency"),
    ("install @tanstack/react-table for data grids",                 "new_dependency"),
    ("add zod for runtime schema validation",                        "new_dependency"),
    ("install framer-motion for animations",                         "new_dependency"),
    ("add sharp for server-side image processing",                   "new_dependency"),
    ("install puppeteer for PDF generation",                         "new_dependency"),
    ("add aws-sdk for S3 file uploads",                              "new_dependency"),
    ("install stripe for payment processing",                        "new_dependency"),
    ("add uuid package for generating unique IDs",                   "new_dependency"),
    ("install helmet for express security headers",                  "new_dependency"),
    ("add winston for structured logging",                           "new_dependency"),
    ("install nodemailer for transactional emails",                  "new_dependency"),
    ("add multer for multipart file upload handling",                "new_dependency"),
    ("install jsonwebtoken for JWT authentication",                  "new_dependency"),
    ("add bcrypt for password hashing",                              "new_dependency"),
    ("install socket.io for real-time websocket support",            "new_dependency"),
    ("add @sentry/node for error tracking",                          "new_dependency"),
    ("install pdfkit for PDF document generation",                   "new_dependency"),
    ("add xlsx for Excel file parsing and export",                   "new_dependency"),
    ("install node-cron for scheduled background jobs",              "new_dependency"),
    ("add cheerio for HTML scraping and parsing",                    "new_dependency"),
    ("install marked for markdown to HTML conversion",               "new_dependency"),
    ("add i18next for internationalisation support",                  "new_dependency"),
    ("install react-hook-form for form state management",            "new_dependency"),
    ("add zustand for lightweight global state",                     "new_dependency"),
    ("install immer for immutable state updates",                    "new_dependency"),
    ("add p-limit for concurrency control in async loops",           "new_dependency"),
    ("install execa for running child processes",                    "new_dependency"),
    ("add dayjs as a lighter moment.js replacement",                 "new_dependency"),
    ("install nanoid for compact unique ID generation",              "new_dependency"),
    ("add validator.js for string validation helpers",               "new_dependency"),
    ("install cross-env for cross-platform env variable setting",    "new_dependency"),
    ("add compression middleware to express",                        "new_dependency"),
    ("install dotenv-safe to enforce required env vars",             "new_dependency"),

    # ── asset_added (30 examples) ─────────────────────────────────────────────
    ("add hero background image to landing page",                    "asset_added"),
    ("include new Inter font files in public/fonts",                 "asset_added"),
    ("add product photos to public/images directory",                "asset_added"),
    ("upload brand logo SVG to assets folder",                       "asset_added"),
    ("add illustration for empty state screen",                      "asset_added"),
    ("include video background for hero section",                    "asset_added"),
    ("add team member headshot photos",                              "asset_added"),
    ("include app store badge images",                               "asset_added"),
    ("add favicon and apple touch icons",                            "asset_added"),
    ("include social sharing preview image (og:image)",              "asset_added"),
    ("add custom icon font (icomoon)",                               "asset_added"),
    ("include high-res background textures",                         "asset_added"),
    ("add animated GIF for onboarding walkthrough",                  "asset_added"),
    ("include partner logo images on homepage",                      "asset_added"),
    ("add woff2 font files for custom typography",                   "asset_added"),
    ("include product screenshot for marketing page",                "asset_added"),
    ("add PDF user manual to static assets",                         "asset_added"),
    ("include audio files for notification sounds",                  "asset_added"),
    ("add 3D model files for interactive viewer",                    "asset_added"),
    ("include Lottie animation JSON for loading screen",             "asset_added"),
    ("add country flags sprite sheet",                               "asset_added"),
    ("include dark mode illustration variants",                      "asset_added"),
    ("add certificate template PDF to downloads",                    "asset_added"),
    ("include map tile assets for offline support",                  "asset_added"),
    ("add emoji sprite sheet for chat feature",                      "asset_added"),
    ("include printable invoice PDF template",                       "asset_added"),
    ("add retina 2x image assets for homepage",                      "asset_added"),
    ("include WebP format images for performance",                   "asset_added"),
    ("add full-bleed background image for pricing page",             "asset_added"),
    ("include icon pack for navigation sidebar",                     "asset_added"),

    # ── feature (40 examples) ─────────────────────────────────────────────────
    ("implement user profile page with avatar upload",               "feature"),
    ("build checkout flow with stripe integration",                  "feature"),
    ("add real-time notification system using websockets",           "feature"),
    ("implement dark mode toggle with localStorage persistence",     "feature"),
    ("add CSV export for analytics dashboard",                       "feature"),
    ("build admin panel for user management",                        "feature"),
    ("implement two-factor authentication via TOTP",                 "feature"),
    ("add team invitations via email",                               "feature"),
    ("implement pagination for search results",                      "feature"),
    ("build drag-and-drop kanban board",                             "feature"),
    ("add webhook delivery system for integrations",                 "feature"),
    ("implement full-text search with debounce",                     "feature"),
    ("add public API with rate limiting",                            "feature"),
    ("build onboarding wizard for new users",                        "feature"),
    ("implement audit log for admin actions",                        "feature"),
    ("add GitHub OAuth login option",                                "feature"),
    ("implement subscription billing portal",                        "feature"),
    ("build comment thread system for documents",                    "feature"),
    ("add multi-language support (i18n)",                            "feature"),
    ("implement keyboard shortcuts for power users",                 "feature"),
    ("add Slack notification integration",                           "feature"),
    ("build interactive chart dashboard with filters",               "feature"),
    ("implement video upload and transcoding pipeline",              "feature"),
    ("add global search with keyboard shortcut (cmd+k)",             "feature"),
    ("implement row-level security for multi-tenant data",           "feature"),
    ("build PDF invoice generation on checkout",                     "feature"),
    ("add geolocation-based currency selection",                     "feature"),
    ("implement infinite scroll for activity feed",                  "feature"),
    ("add QR code generation for sharing",                           "feature"),
    ("build email template editor with preview",                     "feature"),
    ("implement smart notifications with digest mode",               "feature"),
    ("add bulk action support for table rows",                       "feature"),
    ("implement role-based access control (RBAC)",                   "feature"),
    ("build integration with Jira for issue sync",                   "feature"),
    ("add user activity heatmap to analytics",                       "feature"),
    ("implement granular permission settings per repo",              "feature"),
    ("build report scheduling and email delivery",                   "feature"),
    ("add typing indicators to chat interface",                      "feature"),
    ("implement SSO via SAML 2.0",                                   "feature"),
    ("build custom domain support for white-label accounts",         "feature"),

    # ── refactor (35 examples) ────────────────────────────────────────────────
    ("refactor auth middleware to use async/await throughout",       "refactor"),
    ("extract shared utility functions to utils/helpers.ts",         "refactor"),
    ("split monolithic UserController into smaller controllers",     "refactor"),
    ("replace callback-based DB queries with async/await",           "refactor"),
    ("migrate API routes from express to fastify",                   "refactor"),
    ("reorganise component folder structure by feature",             "refactor"),
    ("convert class components to functional with hooks",            "refactor"),
    ("extract email logic into dedicated EmailService module",       "refactor"),
    ("remove dead code from payment processor integration",          "refactor"),
    ("simplify state management by removing redundant Redux slices", "refactor"),
    ("move API constants to shared config file",                     "refactor"),
    ("replace hardcoded strings with i18n keys",                     "refactor"),
    ("decompose 800-line App.tsx into smaller page components",      "refactor"),
    ("extract database connection into singleton module",            "refactor"),
    ("consolidate duplicate validation logic into shared schema",    "refactor"),
    ("switch from moment.js to native Date API",                     "refactor"),
    ("replace axios with native fetch in client code",               "refactor"),
    ("refactor notification system to use observer pattern",         "refactor"),
    ("extract chart configuration into separate config files",       "refactor"),
    ("move business logic out of route handlers into services",      "refactor"),
    ("replace any types with proper TypeScript interfaces",          "refactor"),
    ("consolidate CSS variables and remove duplicates",              "refactor"),
    ("convert CommonJS modules to ES modules throughout",            "refactor"),
    ("replace nested ternaries with clearer switch statements",      "refactor"),
    ("refactor test helpers to avoid code duplication",              "refactor"),
    ("extract job queue logic from controllers into workers",        "refactor"),
    ("consolidate error handling into central middleware",           "refactor"),
    ("simplify useEffect dependencies across components",            "refactor"),
    ("replace promise chains with async/await in services",          "refactor"),
    ("refactor data access layer to repository pattern",             "refactor"),
    ("split large SQL queries into parameterised helper functions",  "refactor"),
    ("move shared types to packages/types shared module",            "refactor"),
    ("replace string error codes with typed error classes",          "refactor"),
    ("extract authentication token logic to dedicated hook",         "refactor"),
    ("reorganise imports to match eslint import order rule",         "refactor"),

    # ── chore (35 examples) ───────────────────────────────────────────────────
    ("fix typo in README installation instructions",                 "chore"),
    ("update comments in auth middleware",                           "chore"),
    ("bump version to 1.2.0",                                        "chore"),
    ("update dependencies to latest patch versions",                 "chore"),
    ("add MIT license file",                                         "chore"),
    ("update .gitignore to exclude .DS_Store",                       "chore"),
    ("fix grammar in onboarding copy",                               "chore"),
    ("update CHANGELOG for v2.1.0 release",                         "chore"),
    ("remove console.log statements from production code",          "chore"),
    ("update node version in .nvmrc to 20.11",                      "chore"),
    ("bump eslint rules to match team standard",                     "chore"),
    ("update Docker base image to node:20-alpine",                   "chore"),
    ("add missing semicolons (prettier autofix)",                    "chore"),
    ("fix spelling error in error message string",                   "chore"),
    ("remove unused import in dashboard component",                  "chore"),
    ("update README badges and shields",                             "chore"),
    ("format code with prettier",                                    "chore"),
    ("update .editorconfig to enforce 2-space indent",               "chore"),
    ("fix broken link in documentation",                             "chore"),
    ("update GitHub Actions node-version to 20",                     "chore"),
    ("add codeowners file for review assignments",                   "chore"),
    ("clean up unused CSS variables from theme file",                "chore"),
    ("update API documentation to reflect new endpoints",           "chore"),
    ("bump jest to v29 for node 20 compatibility",                   "chore"),
    ("remove deprecated webpack config options",                     "chore"),
    ("update tsconfig to strict mode",                               "chore"),
    ("fix env variable name in .env.example",                        "chore"),
    ("add .prettierrc configuration file",                           "chore"),
    ("update package-lock.json after merge conflict resolution",    "chore"),
    ("remove TODO comment that was already addressed",               "chore"),
    ("update storybook to v7",                                       "chore"),
    ("fix linting errors flagged by CI",                             "chore"),
    ("update copyright year in LICENSE",                             "chore"),
    ("add missing test coverage annotation",                         "chore"),
    ("correct variable name in inline code comment",                 "chore"),

    # ── unknown (22 examples) ─────────────────────────────────────────────────
    ("wip",                                                          "unknown"),
    ("fix",                                                          "unknown"),
    ("update stuff",                                                 "unknown"),
    ("changes",                                                      "unknown"),
    ("asdfasdf",                                                     "unknown"),
    ("temp",                                                         "unknown"),
    ("testing 123",                                                  "unknown"),
    ("misc updates",                                                 "unknown"),
    ("more work",                                                    "unknown"),
    ("reverts",                                                      "unknown"),
    ("idk",                                                          "unknown"),
    ("commit",                                                       "unknown"),
    ("done",                                                         "unknown"),
    ("patch",                                                        "unknown"),
    ("hotfix",                                                       "unknown"),
    ("quick fix",                                                    "unknown"),
    ("oops",                                                         "unknown"),
    ("merge branch",                                                 "unknown"),
    ("progress",                                                     "unknown"),
    ("checkpoint",                                                   "unknown"),
    ("cleanup",                                                      "unknown"),
    ("addressing feedback",                                          "unknown"),
]

def train():
    texts, labels = zip(*TRAINING_DATA)
    print(f"Training on {len(texts)} examples across {len(set(labels))} classes")
    print(f"Class distribution: {dict((l, labels.count(l)) for l in set(labels))}")

    vec = TfidfVectorizer(
        ngram_range=(1, 3),
        min_df=1,
        max_features=5000,
        sublinear_tf=True,
    )
    X = vec.fit_transform(texts)

    clf = LogisticRegression(
        max_iter=2000,
        class_weight='balanced',
        C=2.0,
        solver='lbfgs',
        multi_class='multinomial',
    )
    clf.fit(X, labels)

    # Cross-validation score
    scores = cross_val_score(clf, X, labels, cv=5, scoring='accuracy')
    print(f"\nCross-validation accuracy: {np.mean(scores):.2%} ± {np.std(scores):.2%}")
    print(f"Classes: {list(clf.classes_)}")

    joblib.dump(clf, 'commit_classifier.joblib')
    joblib.dump(vec, 'commit_vectorizer.joblib')
    print("\n✅ Saved commit_classifier.joblib + commit_vectorizer.joblib")

if __name__ == '__main__':
    train()
