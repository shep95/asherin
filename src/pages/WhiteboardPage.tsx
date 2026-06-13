import Whiteboard from "@/components/whiteboard/Whiteboard";

/**
 * Standalone /whiteboard route — gives the Whiteboard a true full-viewport
 * shell so its h-full/w-full sizing fills the screen.
 */
const WhiteboardPage = () => {
  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-background">
      <Whiteboard />
    </div>
  );
};

export default WhiteboardPage;
