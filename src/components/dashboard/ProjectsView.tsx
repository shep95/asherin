import { FolderPlus, Layers } from "lucide-react";

const ProjectsView = () => (
  <div className="flex h-full items-center justify-center p-8">
    <div className="text-center max-w-md space-y-6">
      <div className="mx-auto w-16 h-16 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm flex items-center justify-center">
        <Layers className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-extralight tracking-wide text-foreground mb-2">Projects</h2>
        <p className="text-sm font-extralight text-muted-foreground">
          Organize your work into dedicated workspaces. Each project has its own memory, files, and conversation history.
        </p>
      </div>
      <button className="inline-flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-2.5 text-sm font-light text-foreground hover:bg-foreground/5 transition-colors">
        <FolderPlus className="h-4 w-4" />
        Create First Project
      </button>
    </div>
  </div>
);

export default ProjectsView;
