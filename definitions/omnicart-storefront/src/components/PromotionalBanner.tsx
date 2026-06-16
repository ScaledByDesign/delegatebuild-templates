import React from 'react';
import { Link } from 'react-router-dom';

const PromotionalBanner = () => {
  return (
    <div>
      {/* Orange banner */}
      <div className="bg-vnsh-orange text-white text-center py-2 text-sm font-medium">
        <p>New Product: Weapon Mounted Light Compatible Holster Now Available - <Link to="/products/the-vnsh-holster-weapon-mounted-light-compatible" className="underline hover:no-underline">Buy Now and Get 2 FREE Gifts</Link></p>
      </div>
      {/* Black banner */}
      <div className="bg-black text-white text-center py-2 text-xl font-medium">
        <p>🔥 Welcome to our store. Free shipping over $50. 🔥</p>
      </div>
    </div>
  );
};

export default PromotionalBanner;