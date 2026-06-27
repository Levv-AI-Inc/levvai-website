# LevvAI Website

## Local Development

The frontend uses same-origin backend paths such as `/api/session` and
`/auth/password/login-user`. Set `LOCAL_BACKEND_URL` to proxy unmatched API,
auth, and Django admin requests to the local backend.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Run the Django backend on `http://127.0.0.1:8000`, then open:

```text
http://localhost:3000/auth/login
```

Verify the proxy before logging in:

```bash
curl -i http://localhost:3000/healthz
```

It should return the Django health response rather than a Next.js `404`.

The proxy is disabled when `LOCAL_BACKEND_URL` is unset. Production routing
continues to use the load balancer.

See the backend README for the one-time local tenant and admin bootstrap.

## Deploy To Cloud Run

Run this command to deploy the `levvai-website` service to Cloud Run:

```bash
gcloud run deploy levvai-website \
    --source . \
    --region us-east1 \
    --allow-unauthenticated \
    --env-vars-file cloudrun.env
```
