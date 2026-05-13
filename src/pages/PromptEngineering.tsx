import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const sections = [
  {
    number: 1,
    title: "The Art of Effective Prompting",
    content: `Prompt engineering, at its core, is the art and science of crafting effective instructions for large language models (LLMs). It's more than just asking a question; it's about understanding how these complex algorithms interpret language and tailoring your input to elicit the most accurate, relevant, and creative outputs. In a world increasingly shaped by AI, mastering prompt engineering is becoming a crucial skill, unlocking the full potential of these powerful tools and shaping the future of human-computer interaction.`,
  },
  {
    number: 2,
    title: "Clarity & Specificity",
    content: `The key to effective prompt engineering lies in understanding the nuances of language and how LLMs process it. These models, trained on vast datasets, learn to predict the next word in a sequence. Therefore, prompts need to be clear, specific, and contextualized to guide the model towards the desired response.\n\nAmbiguity is the enemy. Instead of asking a vague question like "Tell me about coding," a well-engineered prompt would specify the desired output, such as "Summarize the key differences between Python and Java." This level of detail anchors the model's response, preventing it from wandering into irrelevant territory.`,
  },
  {
    number: 3,
    title: "Context is Paramount",
    content: `LLMs don't operate in a vacuum; they rely on the information provided in the prompt to understand the task at hand. By providing relevant background information, you can significantly improve the quality of the output.\n\nFor example, instead of simply asking "What are the benefits of abstraction?", framing the prompt as "As a software engineer, explain the benefits of abstraction in object-oriented programming" provides the model with the necessary context to generate a more insightful and targeted response.`,
  },
  {
    number: 4,
    title: "The Iterative Process",
    content: `The iterative nature of prompt engineering is crucial. It's rarely a one-shot process. Experimentation and refinement are key to achieving optimal results.\n\nStart with a basic prompt, analyze the model's output, and then adjust the wording, structure, or context based on the feedback. This feedback loop allows you to progressively improve the prompt, guiding the model towards a more accurate and relevant response.\n\nFor instance, if a prompt like "List the advantages of web applications" yields a response that is too broad, refining it to "List the maintenance benefits of web applications compared to native applications" can narrow the scope and produce a more focused output.`,
  },
  {
    number: 5,
    title: "Examples & Constraints",
    content: `Beyond clarity and specificity, effective prompt engineering also involves leveraging techniques like providing examples and incorporating constraints.\n\nDemonstrating the desired output format and content through examples sets clear expectations for the model. For instance, if you want the model to translate a sentence into French, providing an example like "Translate the following sentence to French: Hello, how are you? Example: Hello translates to Bonjour" can significantly improve the accuracy of the translation.\n\nSimilarly, incorporating constraints, such as limiting the response length or excluding specific topics, can further refine the output and prevent the model from generating unwanted or irrelevant information.`,
  },
  {
    number: 6,
    title: "Advanced Techniques",
    content: `As AI technology continues to evolve, staying informed about new prompt engineering strategies is essential. Techniques like role-playing, where you assign a specific role to the model, and sequential prompting, where you break down complex tasks into a series of prompts, can unlock even greater potential.\n\nFor example, asking the model to "As a mechanical engineer, describe the most important sensors to deploy in a heavy manufacturing process" can elicit a more technical and insightful response than a general question about sensors.`,
  },
];

const PromptEngineering = () => {
  return (
    <LandingBackground>

      <Header />

      <div className="relative z-10 px-6 pt-32 pb-24">
        <div className="mx-auto max-w-3xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-12">
            {/* Hero */}
            <div className="text-center mb-12">
              <p className="text-xs font-extralight tracking-[0.3em] uppercase text-muted-foreground/60 mb-4">
                Master the Art
              </p>
              <h1 className="text-3xl sm:text-4xl font-extralight tracking-wide zophiel-shimmer-text mb-4">
                AI Prompt Engineering Mastery — Aureon
              </h1>
              <p className="text-sm font-extralight leading-relaxed text-muted-foreground max-w-xl mx-auto">
                Learn how to craft effective instructions for AI models and unlock their full potential.
              </p>
            </div>

            <div className="w-16 mx-auto border-t border-border/20 mb-12" />

            {/* Sections */}
            <div className="space-y-12">
              {sections.map((s) => (
                <section key={s.number}>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/30 text-xs font-extralight text-muted-foreground">
                      {s.number}
                    </span>
                    <h2 className="text-lg font-light tracking-wide text-foreground">
                      {s.title}
                    </h2>
                  </div>
                  <div className="pl-12 space-y-4">
                    {s.content.split("\n\n").map((p, i) => (
                      <p key={i} className="text-sm font-extralight leading-relaxed text-muted-foreground">
                        {p}
                      </p>
                    ))}
                  </div>
                </section>
              ))}

              {/* Conclusion */}
              <div className="w-16 mx-auto border-t border-border/20" />
              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">
                  Conclusion
                </h2>
                <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
                  Prompt engineering is a dynamic and evolving field that requires a combination of linguistic understanding, technical knowledge, and creative experimentation. By mastering the art of crafting effective prompts, we can unlock the full potential of large language models and harness their power to solve complex problems, generate creative content, and enhance human-computer interaction. As AI becomes increasingly integrated into our lives, the ability to effectively communicate with these powerful tools will be a critical skill for individuals and organizations alike.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </LandingBackground>
  );
};

export default PromptEngineering;
