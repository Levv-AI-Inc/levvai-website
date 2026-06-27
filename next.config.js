const localBackendUrl = process.env.LOCAL_BACKEND_URL?.replace(/\/+$/, '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Django REST Framework uses trailing-slash routes. Avoid a local redirect
  // loop where Next removes the slash and Django immediately adds it back.
  skipTrailingSlashRedirect: Boolean(localBackendUrl),
  async rewrites() {
    if (!localBackendUrl) {
      return []
    }

    return {
      fallback: [
        {
          source: '/api/:path*/',
          destination: `${localBackendUrl}/api/:path*/`,
        },
        {
          source: '/api/:path*',
          destination: `${localBackendUrl}/api/:path*`,
        },
        {
          source: '/auth/:path*/',
          destination: `${localBackendUrl}/auth/:path*/`,
        },
        {
          source: '/auth/:path*',
          destination: `${localBackendUrl}/auth/:path*`,
        },
        {
          source: '/admin/:path*/',
          destination: `${localBackendUrl}/admin/:path*/`,
        },
        {
          source: '/admin/:path*',
          destination: `${localBackendUrl}/admin/:path*`,
        },
        {
          source: '/django-admin/:path*/',
          destination: `${localBackendUrl}/django-admin/:path*/`,
        },
        {
          source: '/django-admin/:path*',
          destination: `${localBackendUrl}/django-admin/:path*`,
        },
        {
          source: '/intake/:path*',
          destination: `${localBackendUrl}/intake/:path*`,
        },
        {
          source: '/approvals/:path*',
          destination: `${localBackendUrl}/approvals/:path*`,
        },
        {
          source: '/nova/:path*',
          destination: `${localBackendUrl}/nova/:path*`,
        },
        {
          source: '/tasks/:path*',
          destination: `${localBackendUrl}/tasks/:path*`,
        },
        {
          source: '/healthz',
          destination: `${localBackendUrl}/healthz`,
        },
      ],
    }
  },
}

module.exports = nextConfig
