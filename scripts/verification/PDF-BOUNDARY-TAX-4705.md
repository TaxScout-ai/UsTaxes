# TAX-4705: restrict bundled PDF template loading

Continues engine `101960b`. No calculation changes, deployment, or IRS traffic.

PR #21's CodeQL check `102728375720` reported uncontrolled filesystem paths
in `server/utils/pdf-downloader.ts` and SSRF in `pdfHandler.ts`. The normal HTTP
route already validates taxYear and installs a filesystem downloader; this
work does not claim a live exploit was established. It removes the unsafe
capabilities from the loaders themselves.

- Runtime year allowlist and exact IRS/state/labeled PDF path grammar reject
  URLs, traversal, encodings, alternate separators, queries and fragments.
- The server resolves the real filesystem target and verifies containment in
  the deployment-configured forms directory, including symlink resolution.
- The browser downloader reconstructs a root-relative bundled URL, forbids
  redirects, checks status, and cannot run as a server network downloader.
- Existing AcroForm-preserving PDF composition remains intact; the empty-packet
  guard now accurately represents an absent first document in its type.

Verification: 31 adversarial and positive tests, including every bundled PDF
path, out-of-root symlinks, and a server execution check that never calls fetch.
Server TypeScript build and changed-file lint pass. The full combined engine
HTTP/PDF regression is recorded with TAX-4702 after integration.

```
CI=true npx craco test --testPathPattern='pdfTemplate(Boundary|Browser).test' --watchAll=false --runInBand --detectOpenHandles
npm run server:build
```

No CodeQL suppression or workflow edit was made. A new remote CodeQL run is
still required; local tests do not establish that the GitHub check is green.
