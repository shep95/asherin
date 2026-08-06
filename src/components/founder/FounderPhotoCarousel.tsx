import { useEffect, useState } from "react";
import portrait1 from "@/assets/founder-portrait-1.png.asset.json";
import portrait2 from "@/assets/founder-portrait-2.png.asset.json";

const photos = [portrait1.url, portrait2.url];

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
          alt="Asher Newton, founder of Asherin"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1400ms] ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
          loading={i === 0 ? "eager" : "lazy"}
        />
      ))}
    </div>
  );
}
