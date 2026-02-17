import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Upload, Search, Loader2, AlertCircle, CheckCircle2,
  ChevronDown, ChevronRight, Link2, X, Eye, Trash2, Tag,
  FileBarChart, Mail, Scale, Stethoscope, GraduationCap, File,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAshaSession } from "./AshaSessionContext";
import { toast } from "sonner";

const DOC_TYPE_ICONS: Record<string, React.ElementType> = {
  contract: Scale,
  invoice: FileBarChart,
  email: Mail,
  legal: Scale,
  medical: Stethoscope,
  research: GraduationCap,
  report: FileText,
  other: File,
  unknown: File,
};

const DOC_TYPE_COLORS: Record<string, string> = {
  contract: "text-blue-400",
  invoice: "text-emerald-400",
  email: "text-amber-400",
  legal: "text-purple-400",
  medical: "text-red-400",
  research: "text-cyan-400",
  report: "text-orange-400",
  other: "text-muted-foreground",
  unknown: "text-muted-foreground",
};

const DocumentIntelligencePanel = () => {
  const { activeSession } = useAshaSession();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"documents" | "search">("documents");

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["asha-documents", activeSession?.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data, error } = await supabase
        .from("asha_documents")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeSession,
  });

  // Fetch entities for expanded doc
  const { data: entities = [] } = useQuery({
    queryKey: ["asha-doc-entities", expandedDoc],
    queryFn: async () => {
      if (!expandedDoc) return [];
      const { data, error } = await supabase
        .from("asha_document_entities")
        .select("*")
        .eq("document_id", expandedDoc)
        .order("confidence", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!expandedDoc,
  });

  // Fetch links for expanded doc
  const { data: links = [] } = useQuery({
    queryKey: ["asha-doc-links", expandedDoc],
    queryFn: async () => {
      if (!expandedDoc) return [];
      const { data, error } = await supabase
        .from("asha_document_links")
        .select("*, source:asha_documents!asha_document_links_source_document_id_fkey(file_name), target:asha_documents!asha_document_links_target_document_id_fkey(file_name)")
        .or(`source_document_id.eq.${expandedDoc},target_document_id.eq.${expandedDoc}`)
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!expandedDoc,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop()?.toLowerCase() || "txt";
      const path = `${session.user.id}/docs/${crypto.randomUUID()}.${ext}`;

      // Upload to storage
      const { error: upErr } = await supabase.storage.from("asha-data").upload(path, file);
      if (upErr) throw new Error("Upload failed: " + upErr.message);

      // Create document record
      const { data: doc, error: docErr } = await supabase.from("asha_documents").insert({
        user_id: session.user.id,
        session_id: activeSession?.id || null,
        file_name: file.name,
        file_type: ext,
        file_size: file.size,
        storage_path: path,
        status: "uploading",
      }).select().single();

      if (docErr || !doc) throw new Error("Failed to create document record");

      // Trigger processing
      const { data: result, error: procErr } = await supabase.functions.invoke("asha-doc-intel", {
        body: { action: "process", documentId: doc.id },
      });

      if (procErr) throw new Error("Processing failed");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asha-documents"] });
      toast.success("Document processed successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const doc = documents.find((d: any) => d.id === docId);
      if (doc) {
        await supabase.storage.from("asha-data").remove([doc.storage_path]);
      }
      const { error } = await supabase.from("asha_documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asha-documents"] });
      if (expandedDoc) setExpandedDoc(null);
      toast.success("Document deleted");
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < Math.min(files.length, 10); i++) {
      if (files[i].size > 20 * 1024 * 1024) {
        toast.error(`${files[i].name} exceeds 20MB limit`);
        continue;
      }
      uploadMutation.mutate(files[i]);
    }
    e.target.value = "";
  }, [uploadMutation]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("asha-doc-intel", {
        body: { action: "search", query: searchQuery },
      });
      if (error) throw error;
      setSearchResults(data);
      setActiveView("search");
    } catch {
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const readyDocs = documents.filter((d: any) => d.status === "ready");
  const processingDocs = documents.filter((d: any) => d.status === "processing" || d.status === "uploading");

  const docTypeCounts = readyDocs.reduce((acc: Record<string, number>, d: any) => {
    acc[d.doc_type] = (acc[d.doc_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-light text-foreground tracking-wide">Document Intelligence</h2>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              {readyDocs.length} document{readyDocs.length !== 1 ? "s" : ""} indexed
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView("documents")}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${activeView === "documents" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <FileText className="h-3.5 w-3.5 inline mr-1.5" />Documents
            </button>
            <button
              onClick={() => setActiveView("search")}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${activeView === "search" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Search className="h-3.5 w-3.5 inline mr-1.5" />Cross-Search
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search across all documents… e.g. 'contracts expiring in 90 days worth over $100k'"
              className="w-full bg-card/30 border border-border/20 rounded-lg pl-9 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 rounded-lg bg-accent/20 text-accent text-xs hover:bg-accent/30 transition-colors disabled:opacity-40"
          >
            {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
          </button>
        </div>

        {/* Upload zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-border/30 rounded-xl p-4 text-center cursor-pointer hover:border-accent/30 hover:bg-accent/5 transition-colors"
        >
          <Upload className="h-5 w-5 mx-auto text-muted-foreground/30 mb-1.5" />
          <p className="text-xs text-muted-foreground/50">
            Drop contracts, invoices, emails, legal docs, reports…
          </p>
          <p className="text-[9px] text-muted-foreground/30 mt-0.5">PDF, TXT, CSV, JSON, MD — up to 20MB</p>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.csv,.json,.md,.doc,.docx,.eml,.html" multiple className="hidden" onChange={handleFileSelect} />
        </div>

        {/* Doc type stats */}
        {Object.keys(docTypeCounts).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {Object.entries(docTypeCounts).map(([type, count]) => {
              const Icon = DOC_TYPE_ICONS[type] || File;
              return (
                <div key={type} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/30 border border-border/10">
                  <Icon className={`h-3 w-3 ${DOC_TYPE_COLORS[type] || "text-muted-foreground"}`} />
                  <span className="text-[10px] text-muted-foreground capitalize">{type}</span>
                  <span className="text-[10px] text-foreground/70 font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-3">
        {/* Processing indicator */}
        {processingDocs.length > 0 && (
          <div className="space-y-2">
            {processingDocs.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
                <Loader2 className="h-4 w-4 text-accent animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{doc.file_name}</p>
                  <p className="text-[10px] text-accent/70">Extracting entities…</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {uploadMutation.isPending && (
          <div className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
            <Loader2 className="h-4 w-4 text-accent animate-spin" />
            <span className="text-xs text-accent/70">Uploading & processing…</span>
          </div>
        )}

        {activeView === "documents" ? (
          <>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
              </div>
            ) : readyDocs.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <FileText className="h-10 w-10 text-muted-foreground/15" />
                <p className="text-xs text-muted-foreground/40">Upload documents to begin extraction</p>
              </div>
            ) : (
              readyDocs.map((doc: any) => {
                const Icon = DOC_TYPE_ICONS[doc.doc_type] || File;
                const isExpanded = expandedDoc === doc.id;
                const meta = doc.metadata || {};

                return (
                  <div key={doc.id} className="rounded-xl border border-border/20 bg-card/20 overflow-hidden">
                    {/* Document header */}
                    <button
                      onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/5 transition-colors text-left"
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${DOC_TYPE_COLORS[doc.doc_type] || "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate">{doc.file_name}</p>
                        <p className="text-[10px] text-muted-foreground/50 line-clamp-1 mt-0.5">{doc.summary}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground capitalize">{doc.doc_type}</span>
                        {meta.parties?.length > 0 && (
                          <span className="text-[9px] text-muted-foreground/40">{meta.parties.length} parties</span>
                        )}
                        {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-border/10 p-4 space-y-4">
                        {/* Summary */}
                        {doc.summary && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Summary</p>
                            <p className="text-xs text-foreground/80 leading-relaxed">{doc.summary}</p>
                          </div>
                        )}

                        {/* Metadata grid */}
                        {Object.keys(meta).length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Extracted Metadata</p>
                            <div className="grid grid-cols-2 gap-2">
                              {meta.contract_type && (
                                <MetaItem label="Contract Type" value={meta.contract_type} />
                              )}
                              {meta.effective_date && (
                                <MetaItem label="Effective Date" value={meta.effective_date} />
                              )}
                              {meta.termination_date && (
                                <MetaItem label="Termination Date" value={meta.termination_date} />
                              )}
                              {meta.total_value && (
                                <MetaItem label="Total Value" value={meta.total_value} />
                              )}
                              {meta.governing_law && (
                                <MetaItem label="Governing Law" value={meta.governing_law} />
                              )}
                              {meta.auto_renewal !== undefined && (
                                <MetaItem label="Auto-Renewal" value={meta.auto_renewal ? "Yes" : "No"} />
                              )}
                              {meta.payment_schedule && (
                                <MetaItem label="Payment Schedule" value={meta.payment_schedule} />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Parties */}
                        {meta.parties?.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1.5">Parties</p>
                            <div className="flex flex-wrap gap-1.5">
                              {meta.parties.map((p: string, i: number) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Entities */}
                        {entities.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">
                              Extracted Entities ({entities.length})
                            </p>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {entities.map((e: any) => (
                                <div key={e.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background/30 text-[10px]">
                                  <span className="px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground capitalize min-w-[60px] text-center">{e.entity_type}</span>
                                  <span className="text-foreground flex-1 truncate">{e.entity_value}</span>
                                  <span className="text-muted-foreground/40">{Math.round(e.confidence * 100)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Cross-document links */}
                        {links.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">
                              <Link2 className="h-3 w-3 inline mr-1" />
                              Linked Documents ({links.length})
                            </p>
                            <div className="space-y-1">
                              {links.map((l: any) => {
                                const linkedName = l.source_document_id === doc.id
                                  ? l.target?.file_name
                                  : l.source?.file_name;
                                return (
                                  <div key={l.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background/30 text-[10px]">
                                    <Link2 className="h-3 w-3 text-accent/50" />
                                    <span className="text-foreground flex-1 truncate">{linkedName || "Unknown"}</span>
                                    <span className="text-muted-foreground/40 capitalize">{l.link_type}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end pt-2 border-t border-border/10">
                          <button
                            onClick={() => deleteMutation.mutate(doc.id)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        ) : (
          /* Search results */
          <div className="space-y-4">
            {searchResults ? (
              <>
                {/* Answer */}
                {searchResults.answer && (
                  <div className="rounded-xl border border-border/20 bg-card/20 p-4">
                    <p className="text-[10px] text-accent uppercase tracking-wider mb-2">Intelligence Report</p>
                    <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap">
                      {searchResults.answer}
                    </div>
                  </div>
                )}

                {/* Matching documents */}
                {searchResults.matching_documents?.length > 0 && (
                  <div className="rounded-xl border border-border/20 bg-card/20 p-4">
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">
                      Matching Documents ({searchResults.matching_documents.length})
                    </p>
                    <div className="space-y-1.5">
                      {searchResults.matching_documents.map((md: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/30">
                          <FileText className="h-3.5 w-3.5 text-accent/50" />
                          <span className="text-xs text-foreground flex-1 truncate">{md.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${md.relevance === "high" ? "bg-emerald-500/10 text-emerald-400" : md.relevance === "medium" ? "bg-amber-500/10 text-amber-400" : "bg-foreground/5 text-muted-foreground"}`}>
                            {md.relevance}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cross references */}
                {searchResults.cross_references?.length > 0 && (
                  <div className="rounded-xl border border-border/20 bg-card/20 p-4">
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Cross-References</p>
                    <ul className="space-y-1">
                      {searchResults.cross_references.map((cr: string, i: number) => (
                        <li key={i} className="text-xs text-foreground/70 flex gap-2">
                          <Link2 className="h-3 w-3 text-accent/40 mt-0.5 flex-shrink-0" />
                          {cr}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Gaps */}
                {searchResults.gaps?.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-2">Intelligence Gaps</p>
                    <ul className="space-y-1">
                      {searchResults.gaps.map((g: string, i: number) => (
                        <li key={i} className="text-xs text-amber-400/70 flex gap-2">
                          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center py-12 gap-3">
                <Search className="h-10 w-10 text-muted-foreground/15" />
                <p className="text-xs text-muted-foreground/40">Search across all your documents</p>
                <p className="text-[10px] text-muted-foreground/25 max-w-sm text-center">
                  Try: "Show all contracts expiring in 90 days with auto-renewal worth over $100k"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const MetaItem = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-background/30 px-3 py-2">
    <p className="text-[9px] text-muted-foreground/40 uppercase">{label}</p>
    <p className="text-[11px] text-foreground/80 mt-0.5">{value}</p>
  </div>
);

export default DocumentIntelligencePanel;
