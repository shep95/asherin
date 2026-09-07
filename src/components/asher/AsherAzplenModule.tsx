import AsherinDataView from "@/components/dashboard/data/AsherinDataView";

/**
 * Asher's mount of asherin.data — the same data intelligence room the main
 * dashboard serves, so both surfaces stay in step.
 */
const AsherAzplenModule = () => (
  <div className="h-full w-full bg-background">
    <AsherinDataView />
  </div>
);

export default AsherAzplenModule;
