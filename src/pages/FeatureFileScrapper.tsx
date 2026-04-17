import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { FileText, Download, Layers, FileSearch, Image, Zap, FolderOpen, Eye, FileType } from "lucide-react";

const FeatureFileScrapper = () => (
  <FeaturePageShell
    documentTitle="File Scrapper — Universal Text Extraction | Aureon"
    eyebrow="Document Intelligence"
    headline={<>Every Document.<br /><span className="text-muted-foreground">One Clean TXT.</span></>}
    subheadline="File Scrapper extracts text from unstructured documents — PDFs, images, scanned files, archives, mixed formats — into a single downloadable TXT file. No format wrangling. No copy/paste."
    tierLabel="Aureon — $199/mo"
    capabilities={[
      { icon: FileText, title: "PDF Extraction", description: "Layout-aware text extraction including columns, tables, and footnotes." },
      { icon: Image, title: "OCR for Images", description: "Optical character recognition on scanned documents and image-only PDFs." },
      { icon: FileType, title: "Multi-Format Support", description: "PDF, DOCX, PPTX, XLSX, TXT, RTF, EPUB, image formats, and archives." },
      { icon: FolderOpen, title: "Bulk Upload", description: "Drop a folder of mixed-format files; receive one consolidated TXT output." },
      { icon: Download, title: "Single TXT Output", description: "Everything merged into one clean text file ready for AI ingestion or grep." },
      { icon: FileSearch, title: "Section Markers", description: "Output preserves source-file boundaries with clear delimiters for downstream parsing." },
      { icon: Layers, title: "Encoding Normalization", description: "All output normalized to UTF-8 with consistent line endings." },
      { icon: Eye, title: "Quality Reporting", description: "Per-file extraction quality score so you know which files need manual review." },
      { icon: Zap, title: "Fast Pipeline", description: "Parallel extraction across uploaded files for high-volume processing." },
    ]}
    useCases={[
      "Feeding mixed-format research libraries into LLMs without format friction",
      "Legal discovery document processing into searchable text",
      "Academic literature reviews across PDFs, slides, and EPUB books",
      "Compliance document ingestion for audit trails",
      "Personal knowledge management — convert any folder into AI-ready text",
    ]}
    ctaTitle="Stop Wrestling With Formats."
    ctaSubtitle="File Scrapper is included in Aureon ($199/mo) and above."
  />
);

export default FeatureFileScrapper;
