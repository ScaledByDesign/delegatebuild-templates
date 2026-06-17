import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { Env } from './core-utils';

interface OmniCartEnv extends Env {
  OMNICART_BACKEND_URL?: string;
  OMNICART_PUBLISHABLE_KEY?: string;
  RESEND_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
}

export function userRoutes(app: Hono<{ Bindings: Env }>) {
  app.get('/api/test', (c) => c.json({ success: true, data: { name: 'omnicart-storefront works' } }));

  // --- Send Contact Email ----------------------------------------------------
  app.post('/api/send-contact-email', async (c) => {
    const env = c.env as OmniCartEnv;
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      // Empty/invalid JSON
    }

    const { name, email, phone, comment, formType, subject } = body;

    if (!email || !comment) {
      return c.json({ error: 'Email and comment are required' }, 400);
    }

    if (!env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return c.json({ error: 'Email service not configured' }, 500);
    }

    const toEmail = 'customercare@vnsh.com';
    const fromEmail = 'VNSH Website <noreply@vnsh.com>';
    const mailSubject = subject || 'Contact Form Submission';

    const emailHtml = `
      <h2>${mailSubject}</h2>
      <p><strong>Form Type:</strong> ${formType}</p>
      <hr />
      <p><strong>Name:</strong> ${name || 'Not provided'}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
      <hr />
      <h3>Message:</h3>
      <p>${String(comment).replace(/\n/g, '<br />')}</p>
      <hr />
      <p><em>Submitted from VNSH website at ${new Date().toISOString()}</em></p>
    `;

    const emailText = `${mailSubject}\n\nForm Type: ${formType}\n---\nName: ${name || 'Not provided'}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\n---\nMessage:\n${comment}\n---\nSubmitted from VNSH website at ${new Date().toISOString()}`;

    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          reply_to: email,
          subject: `[VNSH Website] ${mailSubject} - from ${name || email}`,
          html: emailHtml,
          text: emailText,
        }),
      });

      if (!resendRes.ok) {
        const errorData = await resendRes.text();
        console.error('Resend API error:', errorData);
        return c.json({ error: 'Failed to send email' }, 500);
      }

      const data = await resendRes.json() as any;
      return c.json({
        success: true,
        message: 'Email sent successfully',
        emailId: data.id,
      });
    } catch (error: any) {
      console.error('Error in send-contact-email:', error);
      return c.json({ error: error.message || 'Internal server error' }, 500);
    }
  });

  // --- Update Stripe PaymentIntent Amount (Express Checkout) ------------------
  app.post('/api/store/payment-intent/update-amount', async (c) => {
    const env = c.env as OmniCartEnv;
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      // Empty/invalid JSON
    }

    const { cartId, paymentIntentId } = body;

    if (!cartId || !paymentIntentId) {
      return c.json({ error: 'Missing required fields: cartId and paymentIntentId' }, 400);
    }

    if (!paymentIntentId.startsWith('pi_')) {
      return c.json({ error: 'Invalid paymentIntentId format' }, 400);
    }

    if (!env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY is not configured');
      return c.json({ error: 'Stripe is not configured' }, 500);
    }

    const medusaUrl = env.OMNICART_BACKEND_URL || 'https://demo.omnicart.commerce';
    const publishableKey = env.OMNICART_PUBLISHABLE_KEY || '';

    try {
      // Fetch cart from Medusa (OmniCart) to get current total
      const cartResponse = await fetch(`${medusaUrl.replace(/\/$/, '')}/store/carts/${encodeURIComponent(cartId)}`, {
        headers: {
          'x-publishable-api-key': publishableKey,
        },
      });

      if (!cartResponse.ok) {
        const errorText = await cartResponse.text();
        console.error('Failed to fetch cart from Medusa:', errorText);
        return c.json({ error: 'Failed to fetch cart from Medusa' }, 400);
      }

      const { cart } = await cartResponse.json() as any;
      const amountInCents = Math.round(cart.total);

      console.log(`Updating PaymentIntent ${paymentIntentId} to ${amountInCents} cents ($${amountInCents/100})`);

      // Update Stripe payment intent using Stripe REST API
      const bodyParams = new URLSearchParams();
      bodyParams.append('amount', String(amountInCents));
      bodyParams.append('metadata[cart_id]', cartId);
      bodyParams.append('metadata[updated_at]', new Date().toISOString());
      bodyParams.append('metadata[tax_total]', String(cart.tax_total || 0));
      bodyParams.append('metadata[shipping_total]', String(cart.shipping_total || 0));

      const stripeRes = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      if (!stripeRes.ok) {
        const errorData = await stripeRes.json() as { error?: { message?: string; code?: string } };
        console.error('Stripe API error:', errorData);
        return c.json({
          error: errorData.error?.message || 'Failed to update PaymentIntent',
          code: errorData.error?.code,
        }, stripeRes.status as ContentfulStatusCode);
      }

      const updatedPaymentIntent = await stripeRes.json() as any;

      return c.json({
        success: true,
        paymentIntentId: updatedPaymentIntent.id,
        amount: updatedPaymentIntent.amount,
        currency: updatedPaymentIntent.currency,
      });
    } catch (error: any) {
      console.error('Error updating PaymentIntent:', error);
      return c.json({ error: 'Failed to update PaymentIntent', message: error.message }, 500);
    }
  });

  // --- OmniCart demo-mode guard ---------------------------------------------
  app.all('/api/omnicart/*', async (c, next) => {
    const env = c.env as OmniCartEnv;
    if (!env.OMNICART_BACKEND_URL) {
      return c.json(
        { success: false, error: 'OmniCart backend not configured', demo: true },
        503,
      );
    }
    return next();
  });

  // --- OmniCart storefront proxy --------------------------------------------
  app.all('/api/omnicart/*', async (c) => {
    const env = c.env as OmniCartEnv;

    // Normalize the backend URL: trim, and ensure an absolute https:// origin so
    // the Worker subrequest is valid (a bare host like "shop.example.com" or a
    // relative value would make fetch throw an opaque "internal error").
    let backend = (env.OMNICART_BACKEND_URL || '').trim();
    if (backend && !/^https?:\/\//i.test(backend)) {
      backend = `https://${backend}`;
    }

    const reqUrl = new URL(c.req.url);
    const upstreamPath = c.req.path.replace(/^\/api\/omnicart/, '');
    const targetPath = upstreamPath.startsWith('/store') ? upstreamPath : `/store${upstreamPath}`;
    const target = `${backend.replace(/\/$/, '')}${targetPath}${reqUrl.search}`;

    let targetUrl: URL;
    try {
      targetUrl = new URL(target);
    } catch {
      console.error(`[omnicart-proxy] invalid OMNICART_BACKEND_URL: "${env.OMNICART_BACKEND_URL}"`);
      return c.json(
        { success: false, error: 'OmniCart backend misconfigured: OMNICART_BACKEND_URL is not a valid URL.' },
        502,
      );
    }

    // Guard against a self-referential backend (OMNICART_BACKEND_URL pointing at
    // this app's own host). Fetching it would loop and Cloudflare returns an
    // opaque "internal error; reference = ...". Fail fast with a clear message.
    if (targetUrl.host === reqUrl.host) {
      console.error(`[omnicart-proxy] backend loops back at app host "${reqUrl.host}"; fix OMNICART_BACKEND_URL`);
      return c.json(
        { success: false, error: `OmniCart backend misconfigured: OMNICART_BACKEND_URL points back at this app (${reqUrl.host}). Set it to the OmniCart server URL.` },
        502,
      );
    }

    // Forward only what the store API needs. Copying all inbound headers (host,
    // cf-*, content-length, etc.) to a third-party origin can break the upstream
    // request and leaks client headers.
    const headers = new Headers();
    headers.set('accept', 'application/json');
    const contentType = c.req.header('content-type');
    if (contentType) headers.set('content-type', contentType);
    const cookie = c.req.header('cookie');
    if (cookie) headers.set('cookie', cookie);
    const authorization = c.req.header('authorization');
    if (authorization) headers.set('authorization', authorization);
    if (env.OMNICART_PUBLISHABLE_KEY) {
      headers.set('x-publishable-api-key', env.OMNICART_PUBLISHABLE_KEY);
    }

    const method = c.req.method;
    const init: RequestInit = {
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : c.req.raw.body,
    };

    try {
      const upstream = await fetch(targetUrl.toString(), init);
      const resBody = await upstream.arrayBuffer();
      const resHeaders = new Headers();
      resHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json');
      const setCookie = upstream.headers.get('set-cookie');
      if (setCookie) resHeaders.append('set-cookie', setCookie);
      return new Response(resBody, { status: upstream.status, headers: resHeaders });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      // Log the full target server-side; surface only the host to the client.
      console.error(`[omnicart-proxy] ${method} ${targetUrl.toString()} failed: ${detail}`);
      return c.json(
        { success: false, error: `OmniCart backend unreachable (${targetUrl.host})`, detail },
        502,
      );
    }
  });
}
