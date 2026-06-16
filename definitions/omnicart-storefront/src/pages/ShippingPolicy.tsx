import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import GetTenOffBadge from '@/components/GetTenOffBadge';

const ShippingPolicy = () => {
  return (
    <>
      <style>{`
        .vnsh-body {
          font-size: 120% !important;
        }
      `}</style>
      
      <div className="min-h-screen flex flex-col">
        {/* SEO Meta Tags */}
        <title>Shipping Policy - VNSH</title>
        <meta name="description" content="VNSH Shipping Policy - Orders processed within 1-2 business days. Fedex Smartpost and UPS delivery within 3-7 days. Free shipping over $50." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://vnsh.com/pages/shipping-policy" />
        
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
                "name": "Shipping Policy",
                "item": "https://vnsh.com/pages/shipping-policy"
              }
            ]
          })}
        </script>

        <Navbar />
        <main className="flex-grow bg-white">
          <div className="container mx-auto px-4 py-12">
            <div className="mx-auto max-w-[720px]">
              <h1 className="vnsh-h1 mb-8 text-vnsh-dark">Shipping Policy</h1>

              <div>
                <p className="vnsh-body mb-10">
                  Thank you for visiting and shopping at{' '}
                  <Link to="/" className="text-blue-600 underline hover:text-blue-800" style={{color: '#2563eb'}}>https://vnsh.com</Link>.{' '}
                  Following are the terms and conditions that constitute our Shipping Policy.
                </p>

                <section className="mb-12">
                  <h2 className="vnsh-h2 mb-4 text-vnsh-dark font-bold">Shipment Processing Time</h2>
                  <p className="vnsh-body mb-4">All orders are processed within 1-2 business days. Orders are not shipped or delivered on weekends or holidays.</p>
                  <p className="vnsh-body mb-12">If we are experiencing a high volume of orders, shipments may be delayed by a few days. Please allow additional days in transit for delivery. If there will be a significant delay in shipment of your order, we will contact you via email or telephone.</p>
                </section>

                <section className="mb-12">
                  <h2 className="vnsh-h2 mb-4 text-vnsh-dark font-bold">Shipping Rates & Delivery Estimates</h2>
                  <p className="vnsh-body mb-4">Shipping charges for your order will be calculated and displayed at checkout.</p>
                  <p className="vnsh-body mb-4">Delivery delays can occasionally occur.</p>
                  <p className="vnsh-body">Orders are shipped via Fedex Smartpost and/or UPS and are usually delivered within 3-7 business days.</p>
                </section>

                <section className="mb-12">
                  <h2 className="vnsh-h2 mb-4 text-vnsh-dark font-bold">Shipment Confirmation & Order Tracking</h2>
                  <p className="vnsh-body">You will receive a Shipment Confirmation email once your order has shipped containing your tracking number(s). The tracking number will be active within 24 hours.</p>
                </section>

                <section className="mb-12">
                  <h2 className="vnsh-h2 mb-4 text-vnsh-dark font-bold">Damages</h2>
                  <p className="vnsh-body mb-4">
                    <Link to="/" className="text-blue-600 underline hover:text-blue-800" style={{color: '#2563eb'}}>https://vnsh.com</Link> is not liable for any products damaged or lost during shipping. If you received your order damaged, please contact the shipment carrier to file a claim.
                  </p>
                  <p className="vnsh-body">Please save all packaging materials and damaged goods before filing a claim.</p>
                </section>

                <section className="mb-12">
                  <h2 className="vnsh-h2 mb-4 text-vnsh-dark font-bold">International Shipping Policy</h2>
                  <p className="vnsh-body">We currently do not ship outside the U.S.</p>
                </section>

                <section className="mb-12">
                  <h2 className="vnsh-h2 mb-4 text-vnsh-dark font-bold">Returns Policy</h2>
                  <p className="vnsh-body">
                    Our <Link to="/pages/return-policy" className="text-blue-600 underline hover:text-blue-800" style={{color: '#2563eb'}}>Return & Refund Policy</Link> provides detailed information about options and procedures for returning your order.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </main>
        <GetTenOffBadge />
        <Footer />
      </div>
    </>
  );
};

export default ShippingPolicy;