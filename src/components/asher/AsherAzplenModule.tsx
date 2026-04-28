import AzplenView from "@/components/dashboard/azplen/AzplenView";

/**
 * Asher's mount of the Azplen Intelligence Suite.
 * Reuses the live Azplen system (ingest, ontology, AIP, workflows, etc.)
 * unchanged — the same 'asha_' database backend powers it here.
 */
const AsherAzplenModule = () => {
  return (
    <div className="h-full w-full bg-background">
      <AzplenView />
    </div>
  );
};

export default AsherAzplenModule;
