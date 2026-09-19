import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  stage: "fetching" | "extracting" | "transcribing";
}

const stages = {
  fetching: {
    title: "Fetching Video",
    description: "Retrieving video content...",
  },
  extracting: {
    title: "Processing",
    description: "Preparing for transcription...",
  },
  transcribing: {
    title: "Transcribing",
    description: "Converting speech to text with AI...",
  },
};

export function LoadingState({ stage }: LoadingStateProps) {
  const { title, description } = stages[stage];

  return (
    <div className="w-full max-w-md mx-auto text-center animate-fade-in">
      <div className="relative inline-flex">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse-slow" />
        <div className="relative p-6 rounded-full bg-card border border-border">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
      </div>

      <h3 className="mt-8 text-xl font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-muted-foreground">
        {description}
      </p>

      {/* Progress dots */}
      <div className="mt-6 flex justify-center gap-2">
        {Object.keys(stages).map((key, index) => {
          const stageKeys = Object.keys(stages);
          const currentIndex = stageKeys.indexOf(stage);
          const isActive = index <= currentIndex;

          return (
            <div
              key={key}
              className={`h-2 w-8 rounded-full transition-colors duration-300 ${
                isActive ? "bg-primary" : "bg-muted"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
