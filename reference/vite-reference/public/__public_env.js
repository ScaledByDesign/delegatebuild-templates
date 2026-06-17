// Browser-safe runtime env. The host overwrites this file at deploy with the
// connected workspace's browser-safe connector values. This default keeps the
// object defined (and avoids a 404) when running outside the platform.
window.__PUBLIC_ENV__ = window.__PUBLIC_ENV__ || {};
