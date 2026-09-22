# Security policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a vulnerability

Do not open a public GitHub issue for a security vulnerability.

Use [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) on this repository. Include the affected version, reproduction steps, and impact.

This server is intended to run locally. It does not execute SQL, connect to a database, or write submitted plans or generated results to disk. The HTTP transport binds to `127.0.0.1` and is not an authenticated public service. Please still report issues that could leak plan text, break isolation, or make a local process unsafe to run.

We will acknowledge reports and work on a fix before any public disclosure.
