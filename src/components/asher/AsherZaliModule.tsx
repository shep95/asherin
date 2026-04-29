import ZaliView from "@/components/dashboard/zali/ZaliView";

/**
 * Asher's mount of the ZALI Design Suite.
 * Reuses the live ZALI system (FEA / Thermal / Manufacturing / Optimization,
 * material trends, etc.) unchanged inside the Asher Dashboard chrome.
 */
const AsherZaliModule = () => {
  return (
    <div className="h-full w-full bg-background">
      <ZaliView />
    </div>
  );
};

export default AsherZaliModule;
