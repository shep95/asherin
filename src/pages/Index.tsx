import heroBg from "@/assets/hero-bg.png";

const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Fixed background image with dark overlay */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="fixed inset-0 bg-background/70" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-6 text-6xl font-extralight tracking-[0.3em] text-foreground md:text-8xl">
          ZIALIEL
        </h1>
        <p className="max-w-md text-lg font-extralight tracking-widest text-muted-foreground">
          Everything you need to express yourself without limits
        </p>
      </div>
    </div>
  );
};

export default Index;
