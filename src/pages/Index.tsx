import heroBg from "@/assets/hero-bg.png";
import Header from "@/components/Header";

const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Fixed background image with dark overlay */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="fixed inset-0 bg-black/40" />

      {/* Header */}
      <Header />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="max-w-md text-lg font-extralight tracking-widest text-muted-foreground">
          Everything you need to express yourself without limits
        </p>
      </div>
    </div>
  );
};

export default Index;
