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

      {/* Section 2: The Pain Amplifier */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            You've Been Asking AI Questions.
            <br />
            It's Been Giving You PR Responses.
          </h2>

          {/* Pain Grid */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <span className="text-3xl">🚫</span>
              <h3 className="mt-4 text-lg font-light tracking-wide text-foreground">
                "I Can't Help With That"
              </h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Every time you ask something real, you get a disclaimer instead of an answer.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <span className="text-3xl">🎭</span>
              <h3 className="mt-4 text-lg font-light tracking-wide text-foreground">
                Emotional Engineering
              </h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Other LLMs are trained to make you feel good, not to tell you what's actually true.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <span className="text-3xl">🐌</span>
              <h3 className="mt-4 text-lg font-light tracking-wide text-foreground">
                Code That Doesn't Work
              </h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                You paste the error back 6 times and still get the same broken logic wrapped in confidence.
              </p>
            </div>
          </div>

          {/* Statement */}
          <p className="mt-16 text-xl sm:text-2xl font-extralight tracking-wide text-foreground">
            ZIALIEL was built for one reason:
            <br />
            <span className="text-muted-foreground">You deserve an AI that respects your intelligence.</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
