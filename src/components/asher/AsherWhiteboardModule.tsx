import Whiteboard from "@/components/whiteboard/Whiteboard";

/**
 * Asher's mount of the Whiteboard (infinite canvas, layers, snap grids).
 * Reuses the live Whiteboard page unchanged inside the dashboard chrome.
 */
const AsherWhiteboardModule = () => {
  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <Whiteboard />
    </div>
  );
};

export default AsherWhiteboardModule;
