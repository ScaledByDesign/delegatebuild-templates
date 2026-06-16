import React from 'react';
import Navbar from '@/components/Navbar';
import HeroBanner from '@/components/HeroBanner';
import ProductShowcase from '@/components/ProductShowcase';
import Testimonials from '@/components/Testimonials';
import ContestWinners from '@/components/ContestWinners';
import GuaranteeBadges from '@/components/GuaranteeBadges';
import Footer from '@/components/Footer';

const Index = () => {
  // Organization + WebSite structured data are in index.html (static, available to all crawlers)

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {/* Hero Banner - Main slideshow */}
        <HeroBanner />

        {/* Product Showcase - Image with text section */}
        <ProductShowcase />

        {/* Testimonials - "See Why They Say..." */}
        <Testimonials />

        {/* Contest Winners - Video section */}
        <ContestWinners />

        {/* Guarantee Badges - 3 badges section */}
        <GuaranteeBadges />
      </main>
      <Footer />
    </div>
  );
};

export default Index;