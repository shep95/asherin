import { useEffect, useState } from "react";
import founderImg from "@/assets/founder.jpg";
import photo1 from "@/assets/founder-photo-1.png";
import photo2 from "@/assets/founder-photo-2.png";
import photo3 from "@/assets/founder-photo-3.png";
import photo4 from "@/assets/founder-photo-4.png";

const photos = [founderImg, photo1, photo2, photo3, photo4];

export default function FounderPhotoCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full h-full">
      {photos.map((src, i) => (
        <img
          key={src}
          src={src}
          alt="Asher Newton, founder of Aureon"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1400ms] ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
          loading={i === 0 ? "eager" : "lazy"}
        />
      ))}
    </div>
  );
}
