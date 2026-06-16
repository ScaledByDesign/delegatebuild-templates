import { Hono } from "hono";
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
        const errorData = await stripeRes.json() as any;
        console.error('Stripe API error:', errorData);
        return c.json({
          error: errorData.error?.message || 'Failed to update PaymentIntent',
          code: errorData.error?.code,
        }, stripeRes.status);
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
    const backend = env.OMNICART_BACKEND_URL || 'https://demo.omnicart.commerce';
    const upstreamPath = c.req.path.replace(/^\/api\/omnicart/, '');
    const targetPath = upstreamPath.startsWith('/store') ? upstreamPath : `/store${upstreamPath}`;
    const url = new URL(c.req.url);
    const target = `${backend.replace(/\/$/, '')}${targetPath}${url.search}`;

    const headers = new Headers(c.req.raw.headers);
    headers.delete('host');
    if (env.OMNICART_PUBLISHABLE_KEY) {
      headers.set('x-publishable-api-key', env.OMNICART_PUBLISHABLE_KEY);
    }

    const init: RequestInit = {
      method: c.req.method,
      headers,
      body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    };

    try {
      const upstream = await fetch(target, init);
      const resBody = await upstream.arrayBuffer();
      return new Response(resBody, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
      });
    } catch (err) {
      return c.json(
        { success: false, error: `OmniCart backend unreachable: ${err instanceof Error ? err.message : 'unknown'}` },
        502,
      );
    }
  });
}
