import DocumentStudioView from "./DocumentStudioView";

/** asherin.pages — one document studio: page, deck or book. */
export default function DocumentExportLanding() {
  return (
    <div className="h-full min-h-0 w-full">
      <DocumentStudioView initialKind="page" />
    </div>
  );
}
