---
name: Deployment readiness probe
description: Readiness requirements for the API container used by the DigitalOcean deployment.
---

The API container must bind to `0.0.0.0`, expose its configured port, and return a dependency-free `200` response from `/`.

**Why:** The DigitalOcean readiness probe may use the default root path rather than the API health route. A server that only exposes `/api/healthz` can be running correctly but still fail promotion.

**How to apply:** Keep `/` lightweight and independent of the database, keep `/api/healthz` for API checks, and verify both routes inside the built container before publishing.