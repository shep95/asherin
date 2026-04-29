import NotebooksView from "@/components/dashboard/NotebooksView";

/**
 * Asher's mount of Intelligence Notebooks (SQL execution, SECURITY DEFINER).
 * Reuses the live NotebooksView unchanged inside the dashboard chrome.
 */
const AsherNotebooksModule = () => {
  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <NotebooksView />
    </div>
  );
};

export default AsherNotebooksModule;
