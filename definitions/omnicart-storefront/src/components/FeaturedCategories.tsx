
import React from 'react';
import { Link } from 'react-router-dom';

interface CategoryProps {
  title: string;
  description: string;
  image: string;
  link: string;
}

const CategoryCard = ({ title, description, image, link }: CategoryProps) => {
  return (
    <Link to={link} className="group relative overflow-hidden rounded-lg card-hover">
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20 z-10"></div>
      <img 
        src={image} 
        alt={title} 
        className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute bottom-0 left-0 p-6 z-20 w-full">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-white/80 mb-4">{description}</p>
        <span className="inline-block text-white font-medium underline decoration-2 underline-offset-4 decoration-vnsh-red">
          Shop Now
        </span>
      </div>
    </Link>
  );
};

const FeaturedCategories = () => {
  const categories = [
    {
      title: "Products",
      description: "Browse our full collection of high-quality holsters",
      image: "/lovable-uploads/03b80db3-f1ac-421b-b9c7-97d436eb0dcd.png",
      link: "/collections/products"
    },
    {
      title: "Accessories",
      description: "Enhance your carry with our premium accessories",
      image: "/lovable-uploads/64ed2bb9-333f-48ac-b01f-29baaa5906a1.png",
      link: "/collections/accessories"
    },
    {
      title: "Apparel and Gifts",
      description: "Show your support with VNSH branded items",
      image: "/lovable-uploads/16e2bcd3-6f3b-46fc-aa04-2f81a90375e8.png",
    link: "/collections/vnsh-holsters-apparel-and-gifts"
    }
  ];

  return (
    <section className="py-16 bg-vnsh-lightgray">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">Shop By Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {categories.map((category, index) => (
            <CategoryCard key={index} {...category} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedCategories;

// Also exported as a named export so either import style resolves
// (`import FeaturedCategories from ...` or `import { FeaturedCategories } from ...`).
export { FeaturedCategories };
