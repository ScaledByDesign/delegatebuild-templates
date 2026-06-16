import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const ReturnPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* SEO Meta Tags */}
      <title>Return Policy - VNSH</title>
      <meta name="description" content="VNSH Return Policy - 60-day return window with RMA required. Call 1-888-526-1885 for returns. We provide free return shipping." />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://vnsh.com/pages/return-policy" />
      
      {/* Structured Data for Breadcrumbs */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home", 
              "item": "https://vnsh.com"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Return Policy",
              "item": "https://vnsh.com/pages/return-policy"
            }
          ]
        })}
      </script>

      <Navbar />
      
      <main className="flex-grow bg-white">
        <div className="mx-auto max-w-[980px] px-6 md:max-w-[860px] md:px-8 lg:px-12 py-16">
          <h1 className="text-[34px] md:text-[44px] lg:text-[56px] font-extrabold uppercase tracking-[0.02em] leading-tight text-black mb-5">Return Policy</h1>
          
          <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
            If you would like to return your purchase for a refund, you must reach out to customer support by either{' '}
            <a href="mailto:customercare@vnsh.com" className="text-blue-600 underline hover:text-blue-700">email</a>{' '}
            or phone <a href="tel:+18885261885" className="text-blue-600 underline hover:text-blue-700">1-888-526-1885</a> to receive a return merchandise authorization (RMA).
          </p>
          
          <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
            If you return your purchase without a RMA, we can not guarantee you credit. You have up to 60 days from the date of purchase to request a refund. Once we receive the item we will issue you a prompt refund.
          </p>

          <div>
            <h2 className="mt-12 mb-4 text-[24px] md:text-[28px] lg:text-[32px] font-extrabold uppercase leading-tight text-black">Refunds (if applicable)</h2>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
              Once your return is received and inspected, we will send you an email to notify you that we have received your returned item. We will also notify you of the approval or rejection of your refund.
            </p>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
              If you are approved, then your refund will be processed, and a credit will automatically be applied to your credit card or original method of payment, within a certain amount of days.
            </p>
          </div>

          <div>
            <h2 className="mt-12 mb-4 text-[24px] md:text-[28px] lg:text-[32px] font-extrabold uppercase leading-tight text-black">Late or missing refunds (if applicable)</h2>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
              If you haven't received a refund yet, first check your bank account again.
            </p>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
              Then contact your credit card company, it may take some time before your refund is officially posted.
            </p>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
              Next contact your bank. There is often some processing time before a refund is posted.
            </p>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
              If you've done all of this and you still have not received your refund yet, please contact us at{' '}
              <a href="mailto:customercare@vnsh.com" className="text-blue-600 underline hover:text-blue-700">customercare@vnsh.com</a>.
            </p>
          </div>

          <div>
            <h2 className="mt-12 mb-4 text-[24px] md:text-[28px] lg:text-[32px] font-extrabold uppercase leading-tight text-black">Exchanges (if applicable)</h2>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
              We only replace items if they are defective or damaged. If you need to exchange it for the same item, send us an{' '}
              <a href="mailto:customercare@vnsh.com" className="text-blue-600 underline hover:text-blue-700">email</a> at{' '}
              <a href="mailto:customercare@vnsh.com" className="text-blue-600 underline hover:text-blue-700">customercare@vnsh.com</a>
            </p>
          </div>

          <div>
            <h2 className="mt-12 mb-4 text-[24px] md:text-[28px] lg:text-[32px] font-extrabold uppercase leading-tight text-black">Gifts</h2>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
              If the item was marked as a gift when purchased and shipped directly to you, you'll receive a gift credit for the value of your return. Once the returned item is received, a gift certificate will be mailed to you.
            </p>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">
              If the item wasn't marked as a gift when purchased, or the gift giver had the order shipped to themselves to give to you later, we will send a refund to the gift giver and he will find out about your return.
            </p>
          </div>

          <div>
            <h2 className="mt-12 mb-4 text-[24px] md:text-[28px] lg:text-[32px] font-extrabold uppercase leading-tight text-black">Shipping</h2>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800 mb-5">To return your product you should mail your product to:</p>
            <div className="ml-8 space-y-2">
              <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800">QuickBox - Sicuro Brands</p>
              <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800">c/o VNSH.com</p>
              <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800">11551 E 45th Avenue, Unit C,</p>
              <p className="text-[16px] md:text-[18px] lg:text-[20px] leading-8 text-neutral-800">Denver, Colorado, 80239, United States</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ReturnPolicy;