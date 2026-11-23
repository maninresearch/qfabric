# Security Policy

QFabric runs contributor-written markdown through a build pipeline and ships web
components that run in readers' browsers. Both surfaces matter.

## Reporting a vulnerability

Please report security issues privately. **Do not open a public issue.**

Use GitHub's private vulnerability reporting: open the repository's
[Security tab](https://github.com/maninresearch/qfabric/security) and choose
**Report a vulnerability**.

We aim to acknowledge reports within 72 hours and to ship a fix or mitigation for
confirmed issues as quickly as is practical. Reporters who wish to be named are
credited once a fix is released.

## Supported versions

QFabric is pre-1.0. Until 1.0, only the latest minor release receives security
fixes. After 1.0 we will support the current major line.

## Security model

These protections are implemented today:

- **No YAML code execution.** Directive YAML is parsed only with `js-yaml`'s
  `JSON_SCHEMA`, so tags such as `!!js/function` are rejected. A test covers this.
- **Validated directive names.** A directive name becomes part of a tag name, so
  only lowercase letters, digits and single hyphens are accepted (for example
  `state-vector`). Anything else becomes an inline error card instead of HTML.
  Tests cover this, including injection attempts.
- **Escaped attribute values.** Directive parameter values are HTML-escaped when
  they become attributes, and nested config is serialized with `JSON.stringify`.
  A test covers this.
- **Prototype-pollution hardening.** Parsed directive config is recursively
  stripped of `__proto__`, `constructor` and `prototype` keys at build time. A
  test covers this.
- **No `innerHTML` in components.** Components render through Lit templates and
  never pass directive, config, state or event data to `innerHTML`, `outerHTML`,
  `insertAdjacentHTML` or `unsafeHTML`.
- **No telemetry or third-party requests.** QFabric collects no data. The
  components make no network requests, and `@qfabric/astro` self-hosts its fonts.

Lesson authors can still write raw HTML in markdown, as markdown allows. Sites
that publish markdown from untrusted authors should sanitize the rendered HTML,
as they would for any markdown pipeline.
