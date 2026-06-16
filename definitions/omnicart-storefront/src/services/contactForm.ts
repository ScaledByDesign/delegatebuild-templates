import { supabase } from '@/integrations/supabase/client';

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  comment: string;
  formType: 'contact' | 'thankyou' | 'trn-cancel';
  subject?: string;
}

export interface ContactFormResponse {
  success: boolean;
  message: string;
  ticketId?: string;
}

/**
 * Send to Maropost (matches vnshholsters.com source behavior exactly)
 * This replicates the saveEmail1() function from the Shopify theme
 */
async function sendToMaropost(email: string, fname: string, tag: string): Promise<void> {
  // Validate email with the same regex as the source
  const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  if (!emailRegex.test(email)) {
    console.log('Maropost: Invalid email, skipping');
    return;
  }

  // Encode + as %2B (matches source behavior)
  const encodedEmail = email.replace(/\+/g, '%2B');
  const encodedName = encodeURIComponent(fname);

  const url = `https://secured.patriotwholesale.com/maropost/maropost_vnsh_optin.php?email=${encodedEmail}&fname=${encodedName}&tag1=${tag}`;

  try {
    // Use fetch with no-cors mode since this is a cross-origin request
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors'
    });
    console.log('Maropost: Email sent successfully');
  } catch (error) {
    // Don't throw - Maropost failure shouldn't block form submission
    console.warn('Maropost: Failed to send, but continuing with form submission', error);
  }
}

/**
 * Submit a contact form and send email notification to customercare@vnsh.com
 * Also sends to Maropost for marketing integration (matches source vnshholsters.com behavior)
 */
export async function submitContactForm(data: ContactFormData): Promise<ContactFormResponse> {
  try {
    // Send to Maropost first (matches source page behavior)
    // Both contact and thankyou forms use vnsh-shopify-support-form (matches source vnshholsters.com)
    const maropostTag = data.formType === 'trn-cancel'
      ? 'vnsh-cancel-form'
      : 'vnsh-shopify-support-form';

    await sendToMaropost(data.email, data.name, maropostTag);

    // Call the Vercel serverless function to send email
    const response = await fetch('/api/send-contact-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        comment: data.comment,
        formType: data.formType,
        subject: data.subject || getDefaultSubject(data.formType),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error sending contact form:', errorData);
      throw new Error(errorData.error || 'Failed to send message');
    }

    const responseData = await response.json().catch(() => ({}));

    return {
      success: true,
      message: 'Your message has been sent successfully!',
      ticketId: responseData?.emailId,
    };
  } catch (error) {
    console.error('Contact form submission error:', error);

    // Fallback: Try to store in database even if email fails
    try {
      await storeContactSubmission(data);
      return {
        success: true,
        message: 'Your message has been received. We will get back to you soon.',
      };
    } catch (dbError) {
      console.error('Failed to store contact submission:', dbError);
      throw new Error('Failed to send message. Please try again or email us directly at customercare@vnsh.com');
    }
  }
}

/**
 * Store contact form submission in the database
 */
async function storeContactSubmission(data: ContactFormData): Promise<void> {
  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const { error } = await supabase
    .from('support_ticket')
    .insert({
      id: ticketId,
      platform: 'website',
      platform_ticket_id: ticketId,
      subject: data.subject || getDefaultSubject(data.formType),
      status: 'open',
      priority: 'medium',
      source: 'web',
      customer_email: data.email,
      customer_name: data.name,
      customer_phone: data.phone || null,
      metadata: {
        comment: data.comment,
        form_type: data.formType,
        submitted_at: new Date().toISOString(),
      },
      sync_status: 'pending',
      is_open: true,
      is_read: false,
    });

  if (error) {
    console.error('Error storing contact submission:', error);
    throw error;
  }
}

/**
 * Get default subject based on form type
 */
function getDefaultSubject(formType: string): string {
  switch (formType) {
    case 'thankyou':
      return 'Question about VNSH Holster Setup';
    case 'trn-cancel':
      return 'TRN Membership Cancellation Request';
    case 'contact':
    default:
      return 'Contact Form Submission';
  }
}

