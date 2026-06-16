
import React from 'react';
import { Shield, CheckCircle, Award, Truck } from 'lucide-react';

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureItem = ({ icon, title, description }: FeatureProps) => {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-vnsh-red mb-4">
        {icon}
      </div>
      <h3 className="vnsh-h3 mb-2">{title}</h3>
      <p className="vnsh-body text-gray-600">{description}</p>
    </div>
  );
};

const FeatureHighlights = () => {
  const features = [
    {
      icon: <Shield size={40} />,
      title: "Lifetime Warranty",
      description: "All our holsters come with a no-questions-asked lifetime warranty."
    },
    {
      icon: <CheckCircle size={40} />,
      title: "Military Grade Materials",
      description: "Engineered with premium materials for durability and performance."
    },
    {
      icon: <Award size={40} />,
      title: "Made in USA",
      description: "Proudly designed and manufactured in the United States."
    },
    {
      icon: <Truck size={40} />,
      title: "Fast Shipping",
      description: "Orders ship within 24-48 hours with tracking provided."
    }
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <FeatureItem key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureHighlights;
