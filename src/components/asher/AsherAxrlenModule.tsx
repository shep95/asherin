import AxrlenView from "@/components/dashboard/axrlen/AxrlenView";

/**
 * Asher's mount of the AXRLEN prediction engine (Nexus Prime).
 * Reuses the live AXRLEN view unchanged inside the dashboard chrome.
 */
const AsherAxrlenModule = () => {
  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <AxrlenView />
    </div>
  );
};

export default AsherAxrlenModule;
