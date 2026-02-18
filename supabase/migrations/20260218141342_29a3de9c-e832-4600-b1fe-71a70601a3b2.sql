-- Performance indexes for ASHA tables
CREATE INDEX IF NOT EXISTS idx_asha_datasets_session ON asha_datasets(session_id);
CREATE INDEX IF NOT EXISTS idx_asha_datasets_user_session ON asha_datasets(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_asha_datasets_status ON asha_datasets(status);
CREATE INDEX IF NOT EXISTS idx_asha_documents_session ON asha_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_asha_documents_user_session ON asha_documents(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_asha_insights_user ON asha_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_asha_insights_dataset ON asha_insights(dataset_id);
CREATE INDEX IF NOT EXISTS idx_asha_insights_dismissed ON asha_insights(dismissed);
CREATE INDEX IF NOT EXISTS idx_asha_reports_session ON asha_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_asha_reports_user ON asha_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_asha_sessions_user ON asha_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_asha_sessions_active ON asha_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_asha_alerts_user ON asha_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_asha_alerts_read ON asha_alerts(user_id, read);
CREATE INDEX IF NOT EXISTS idx_nomad_investigations_user ON nomad_investigations(user_id);
CREATE INDEX IF NOT EXISTS idx_nomad_entities_investigation ON nomad_entities(investigation_id);
CREATE INDEX IF NOT EXISTS idx_notebook_cells_notebook ON notebook_cells(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_cells_position ON notebook_cells(notebook_id, position);