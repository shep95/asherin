import heroBg from "@/assets/hero-bg.jpeg";
import Header from "@/components/Header";

const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Fixed background image with dark overlay */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="fixed inset-0 bg-black/80" />

      {/* Header */}
      <Header />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight text-foreground">
          The AI That Actually Tells You The Truth.
        </h1>
        <p className="mt-6 max-w-2xl text-base sm:text-lg font-extralight leading-relaxed tracking-wide text-muted-foreground">
          No filters. No emotional manipulation. No hidden agendas. ZIALIEL gives you uncensored answers, brutal logic, and code that outperforms the leading models.
        </p>
      </div>
    </div>
  );
};

export default Index;
