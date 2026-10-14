# Maintained dependency security backports

These three packages are narrow local forks of their upstream npm sources. Each
fork keeps the upstream license and changes only the affected runtime source.
The package versions below are TripFlow compatibility versions, not releases
published by the upstream maintainers. Regression tests exercise the reported
failure modes through the same public entry points used by the dependency tree.

| Package | Upstream base | Local version | Advisory | Backport |
| --- | --- | --- | --- | --- |
| `node-forge` | 1.4.0 | 1.4.1 | GHSA-86W9-CPQP-85RV | Require the nested RSA `DigestAlgorithm` ASN.1 sequence to contain exactly its OID and optional NULL, following [upstream PR #1152](https://github.com/digitalbazaar/forge/pull/1152). |
| `braces` | 3.0.3 | 3.0.4 | GHSA-VFJ7-8CJW-P6XM | Reject brace or parenthesis AST nesting deeper than 256 before recursive compile/expand walkers run. |
| `sprintf-js` | 1.0.3 | 1.1.4 | GHSA-HP3W-G68C-FV3C | Clamp numeric precision to JavaScript's supported maximum of 100 and normalize `%g` precision zero to one. |

Review upstream release notes for every dependency update. Replace each local
override with an upstream release only after confirming that it includes the
corresponding fix and the regression suite still passes. Remove its fork and
fixture in that same change. Do not add these advisories to the audit allowlist.
