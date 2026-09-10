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

## Integration with published main, 2026-09-10

PR #21 was independently merged as `abc8224`; its head `5971cbf` had green
CodeQL. Its direct URL guard and per-year containment intent are preserved
alongside the runtime path grammar, no-redirect policy and filesystem realpath
checks. The two conflicting files are resolved by combining both changes.

A synthetic check found that main followed an out-of-bundle file symlink;
the earlier TAX-4705 implementation also allowed a symlink into a different
year. The combined boundary now anchors the logical year under the canonical
forms root and checks the resolved file target against that year. Added both
file-symlink and year-directory-symlink cross-year regression cases. Original
main's 12 tests are retained; path refusals now use the earlier strict grammar
error. Genuine PDF positive checks and no-network negative checks remain.

This new combined tree still needs its own remote CodeQL run when publication
is authorized; main's green result is not represented as verification of it.
