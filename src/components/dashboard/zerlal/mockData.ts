import type { ZerlalProject, ZerlalFinding, ScanProfile, IntegrationTile } from "./types";

export const mockProjects: ZerlalProject[] = [
  {
    id: "p1",
    name: "aureon-core",
    repoUrl: "https://github.com/aureon/core",
    lastScanAt: "2026-04-08T10:30:00Z",
    riskGrade: "B",
    scanDuration: 342,
    language: "TypeScript",
    criticalCount: 2,
    highCount: 7,
    mediumCount: 14,
    lowCount: 23,
    infoCount: 8,
    status: "complete",
  },
  {
    id: "p2",
    name: "payment-service",
    repoUrl: "https://github.com/aureon/payments",
    lastScanAt: "2026-04-07T18:15:00Z",
    riskGrade: "C",
    scanDuration: 187,
    language: "Go",
    criticalCount: 5,
    highCount: 12,
    mediumCount: 9,
    lowCount: 15,
    infoCount: 3,
    status: "complete",
  },
  {
    id: "p3",
    name: "infra-terraform",
    repoUrl: "https://github.com/aureon/infra",
    lastScanAt: "2026-04-06T09:00:00Z",
    riskGrade: "D",
    scanDuration: 78,
    language: "HCL",
    criticalCount: 8,
    highCount: 4,
    mediumCount: 6,
    lowCount: 2,
    infoCount: 1,
    status: "complete",
  },
  {
    id: "p4",
    name: "ml-pipeline",
    repoUrl: "https://github.com/aureon/ml",
    lastScanAt: null,
    riskGrade: "A",
    scanDuration: null,
    language: "Python",
    criticalCount: 0,
    highCount: 1,
    mediumCount: 3,
    lowCount: 7,
    infoCount: 12,
    status: "idle",
  },
];

export const mockFindings: ZerlalFinding[] = [
  {
    id: "f1",
    projectId: "p1",
    severity: "critical",
    title: "SQL Injection via unsanitized user input in query builder",
    file: "src/db/queryBuilder.ts",
    line: 142,
    category: "injection",
    confidence: 97,
    age: 3,
    assignee: null,
    status: "open",
    cweId: "CWE-89",
    cvssScore: 9.8,
    description: "User-controlled input is concatenated directly into a SQL query string without parameterization. An attacker can inject arbitrary SQL commands to read, modify, or delete database contents.",
    impact: "An attacker could extract the entire user database including hashed passwords, modify financial records, or drop critical tables. This is internet-facing and handles authentication flows.",
    codeSnippet: `// Line 140-145 of src/db/queryBuilder.ts
const query = \`SELECT * FROM users WHERE email = '\${userInput}'\`;
// userInput flows from req.body.email without sanitization
const result = await db.execute(query);
return result.rows;`,
    suggestedFix: `// Use parameterized queries instead
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.execute(query, [userInput]);
return result.rows;`,
    dataflowTrace: [
      { file: "src/routes/auth.ts", line: 23, label: "req.body.email (entry point)" },
      { file: "src/middleware/validate.ts", line: 45, label: "passes through without sanitization" },
      { file: "src/services/userService.ts", line: 89, label: "forwarded as 'email' parameter" },
      { file: "src/db/queryBuilder.ts", line: 142, label: "concatenated into SQL (SINK)" },
    ],
    chainedWith: [],
    complianceControls: ["SOC 2 CC6.1", "PCI DSS 6.5.1", "OWASP A03:2021"],
    similarCves: ["CVE-2024-29824", "CVE-2023-34362"],
    discoveredAt: "2026-04-05T14:22:00Z",
  },
  {
    id: "f2",
    projectId: "p1",
    severity: "critical",
    title: "Hardcoded AWS credentials in configuration module",
    file: "src/config/aws.ts",
    line: 8,
    category: "secrets",
    confidence: 99,
    age: 12,
    assignee: "security-team",
    status: "in-progress",
    cweId: "CWE-798",
    cvssScore: 9.1,
    description: "AWS access key and secret key are hardcoded as string literals. These credentials grant S3 and DynamoDB access to the production environment.",
    impact: "An attacker with source code access could use these credentials to access all S3 buckets and DynamoDB tables, exfiltrate customer data, or deploy malicious infrastructure under your AWS account.",
    codeSnippet: `// Line 7-12 of src/config/aws.ts
const awsConfig = {
  accessKeyId: 'AKIA████████████████',
  secretAccessKey: 'wJal████████████████████████████████████',
  region: 'us-east-1',
};`,
    suggestedFix: `// Use environment variables or AWS IAM roles
const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
};`,
    dataflowTrace: [
      { file: "src/config/aws.ts", line: 8, label: "Hardcoded credential (SOURCE)" },
      { file: "src/services/s3Client.ts", line: 15, label: "used in AWS SDK initialization" },
      { file: "src/services/storage.ts", line: 32, label: "grants full S3 bucket access" },
    ],
    chainedWith: [],
    complianceControls: ["SOC 2 CC6.3", "ISO 27001 A.9.4.3", "PCI DSS 6.5.3"],
    similarCves: ["CVE-2023-35078"],
    discoveredAt: "2026-03-27T08:11:00Z",
  },
  {
    id: "f3",
    projectId: "p2",
    severity: "high",
    title: "Race condition in payment processing allows double-spend",
    file: "pkg/payments/processor.go",
    line: 234,
    category: "logic",
    confidence: 85,
    age: 5,
    assignee: null,
    status: "open",
    cweId: "CWE-362",
    cvssScore: 8.1,
    description: "The payment deduction and balance check are not atomic. Two concurrent requests can both pass the balance check before either deduction is applied, allowing a user to spend more than their balance.",
    impact: "Users could exploit this to make purchases exceeding their account balance, causing direct financial loss. The race window is approximately 50ms under normal load.",
    codeSnippet: `// Line 230-240 of pkg/payments/processor.go
balance := getBalance(userID)  // Step 1: Check
if balance >= amount {
    deductBalance(userID, amount)  // Step 2: Deduct (NOT ATOMIC)
    processPayment(order)
}`,
    suggestedFix: `// Use database-level locking or atomic operation
tx := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
balance := getBalanceTx(tx, userID)
if balance >= amount {
    deductBalanceTx(tx, userID, amount)
    tx.Commit()
    processPayment(order)
} else {
    tx.Rollback()
}`,
    dataflowTrace: [
      { file: "pkg/api/handler.go", line: 67, label: "HTTP POST /pay (entry)" },
      { file: "pkg/payments/processor.go", line: 230, label: "balance check (non-atomic)" },
      { file: "pkg/payments/processor.go", line: 234, label: "deduction (race window)" },
    ],
    chainedWith: [],
    complianceControls: ["PCI DSS 6.5.2", "SOC 2 CC7.2"],
    similarCves: ["CVE-2022-21449"],
    discoveredAt: "2026-04-03T11:45:00Z",
  },
  {
    id: "f4",
    projectId: "p2",
    severity: "high",
    title: "Missing TLS certificate validation in payment gateway client",
    file: "pkg/gateway/client.go",
    line: 45,
    category: "crypto",
    confidence: 98,
    age: 8,
    assignee: null,
    status: "open",
    cweId: "CWE-295",
    cvssScore: 7.5,
    description: "The HTTP client used to communicate with the payment gateway has TLS certificate verification disabled (InsecureSkipVerify: true), making it vulnerable to man-in-the-middle attacks.",
    impact: "An attacker on the network path could intercept payment data including card numbers and authentication tokens by presenting a fraudulent TLS certificate.",
    codeSnippet: `// Line 43-48 of pkg/gateway/client.go
client := &http.Client{
  Transport: &http.Transport{
    TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
  },
}`,
    suggestedFix: `// Remove InsecureSkipVerify, use proper CA bundle
client := &http.Client{
  Transport: &http.Transport{
    TLSClientConfig: &tls.Config{
      MinVersion: tls.VersionTLS13,
    },
  },
}`,
    dataflowTrace: [
      { file: "pkg/gateway/client.go", line: 45, label: "TLS validation disabled" },
      { file: "pkg/gateway/charge.go", line: 78, label: "sends card data over insecure connection" },
    ],
    chainedWith: ["f3"],
    complianceControls: ["PCI DSS 4.1", "SOC 2 CC6.7"],
    similarCves: ["CVE-2023-44487"],
    discoveredAt: "2026-03-31T16:00:00Z",
  },
  {
    id: "f5",
    projectId: "p3",
    severity: "critical",
    title: "Terraform S3 bucket with public-read ACL exposing customer data",
    file: "modules/storage/main.tf",
    line: 18,
    category: "config",
    confidence: 100,
    age: 15,
    assignee: "infra-team",
    status: "open",
    cweId: "CWE-732",
    cvssScore: 9.4,
    description: "The S3 bucket storing customer documents is configured with 'public-read' ACL and no bucket policy restricting access. All objects are publicly accessible via the internet.",
    impact: "Any person on the internet can read all customer documents stored in this bucket. This includes contracts, identity documents, and financial records for approximately 50,000 customers.",
    codeSnippet: `# Line 15-22 of modules/storage/main.tf
resource "aws_s3_bucket" "customer_docs" {
  bucket = "aureon-customer-documents"
  acl    = "public-read"   # DANGEROUS
  
  tags = {
    Environment = "production"
  }
}`,
    suggestedFix: `resource "aws_s3_bucket" "customer_docs" {
  bucket = "aureon-customer-documents"
  
  tags = {
    Environment = "production"
  }
}

resource "aws_s3_bucket_public_access_block" "customer_docs" {
  bucket = aws_s3_bucket.customer_docs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}`,
    dataflowTrace: [
      { file: "modules/storage/main.tf", line: 18, label: "public-read ACL set" },
    ],
    chainedWith: [],
    complianceControls: ["SOC 2 CC6.1", "HIPAA 164.312(a)(1)", "FedRAMP AC-3"],
    similarCves: ["CVE-2023-35813"],
    discoveredAt: "2026-03-24T07:30:00Z",
  },
  {
    id: "f6",
    projectId: "p1",
    severity: "medium",
    title: "Cross-site scripting via reflected user parameter in search",
    file: "src/routes/search.ts",
    line: 67,
    category: "injection",
    confidence: 91,
    age: 7,
    assignee: null,
    status: "open",
    cweId: "CWE-79",
    cvssScore: 6.1,
    description: "The search query parameter is reflected in the HTML response without proper encoding, allowing script injection.",
    impact: "An attacker could craft a malicious URL that executes JavaScript in the context of a victim's session, potentially stealing session tokens or performing actions on their behalf.",
    codeSnippet: `// Line 65-70
res.send(\`<div>Results for: \${req.query.q}</div>\`);`,
    suggestedFix: `import { escapeHtml } from '../utils/sanitize';
res.send(\`<div>Results for: \${escapeHtml(req.query.q)}</div>\`);`,
    dataflowTrace: [
      { file: "src/routes/search.ts", line: 67, label: "query param reflected without encoding" },
    ],
    chainedWith: [],
    complianceControls: ["OWASP A03:2021"],
    similarCves: ["CVE-2024-12345"],
    discoveredAt: "2026-04-01T13:00:00Z",
  },
  {
    id: "f7",
    projectId: "p2",
    severity: "medium",
    title: "Vulnerable dependency: lodash@4.17.20 (prototype pollution)",
    file: "package.json",
    line: 15,
    category: "dependencies",
    confidence: 100,
    age: 30,
    assignee: null,
    status: "open",
    cweId: "CWE-1321",
    cvssScore: 5.6,
    description: "lodash version 4.17.20 is vulnerable to prototype pollution via the merge and zipObjectDeep functions.",
    impact: "Could allow an attacker to modify object prototypes, potentially leading to property injection or denial of service. Reachability analysis confirms merge() is called with user input.",
    codeSnippet: `"lodash": "4.17.20"`,
    suggestedFix: `"lodash": "4.17.21"`,
    dataflowTrace: [],
    chainedWith: [],
    complianceControls: ["SOC 2 CC7.1"],
    similarCves: ["CVE-2021-23337"],
    discoveredAt: "2026-03-09T10:00:00Z",
  },
  {
    id: "f8",
    projectId: "p1",
    severity: "low",
    title: "Debug logging exposes internal paths and stack traces",
    file: "src/middleware/errorHandler.ts",
    line: 34,
    category: "config",
    confidence: 88,
    age: 20,
    assignee: null,
    status: "open",
    cweId: "CWE-209",
    cvssScore: 3.7,
    description: "Error handler sends full stack traces including internal file paths to the client in production mode.",
    impact: "Exposes internal architecture information that could aid an attacker in mapping the application structure.",
    codeSnippet: `res.status(500).json({ error: err.message, stack: err.stack });`,
    suggestedFix: `res.status(500).json({ error: 'Internal server error' });
logger.error(err); // Log internally only`,
    dataflowTrace: [],
    chainedWith: [],
    complianceControls: ["OWASP A09:2021"],
    similarCves: [],
    discoveredAt: "2026-03-19T09:15:00Z",
  },
];

export const scanProfiles: ScanProfile[] = [
  {
    id: "security-audit",
    name: "Security Audit",
    description: "Comprehensive security analysis including SAST, SCA, and secret detection",
    estimatedTime: "15-30 min",
    includes: ["Static Analysis", "Dependency Scan", "Secret Detection", "License Check"],
  },
  {
    id: "pre-deploy",
    name: "Pre-deployment Check",
    description: "Fast scan focused on critical and high-severity issues only",
    estimatedTime: "3-8 min",
    includes: ["Critical SAST Rules", "Known CVE Check", "Secret Detection"],
  },
  {
    id: "compliance",
    name: "Compliance Scan",
    description: "Maps findings to SOC 2, PCI DSS, HIPAA, and ISO 27001 controls",
    estimatedTime: "20-45 min",
    includes: ["Full SAST", "SCA", "Compliance Mapping", "SBOM Generation"],
  },
  {
    id: "deep-scan",
    name: "Full Deep Scan",
    description: "Maximum depth analysis including AI-assisted novel pattern detection",
    estimatedTime: "45-120 min",
    includes: ["Full SAST", "SCA", "Secret Detection", "AI Analysis", "Chain Detection", "Dataflow Tracing", "Protocol Validation"],
  },
];

export const integrations: IntegrationTile[] = [
  { id: "github-actions", name: "GitHub Actions", category: "cicd", icon: "◈", connected: true },
  { id: "gitlab-ci", name: "GitLab CI", category: "cicd", icon: "◈", connected: false },
  { id: "jenkins", name: "Jenkins", category: "cicd", icon: "◈", connected: false },
  { id: "circleci", name: "CircleCI", category: "cicd", icon: "◈", connected: false },
  { id: "azure-devops", name: "Azure DevOps", category: "cicd", icon: "◈", connected: false },
  { id: "jira", name: "JIRA", category: "issues", icon: "◉", connected: true },
  { id: "linear", name: "Linear", category: "issues", icon: "◉", connected: true },
  { id: "github-issues", name: "GitHub Issues", category: "issues", icon: "◉", connected: true },
  { id: "shortcut", name: "Shortcut", category: "issues", icon: "◉", connected: false },
  { id: "slack", name: "Slack", category: "comms", icon: "◎", connected: true },
  { id: "teams", name: "Microsoft Teams", category: "comms", icon: "◎", connected: false },
  { id: "pagerduty", name: "PagerDuty", category: "comms", icon: "◎", connected: false },
  { id: "okta", name: "Okta", category: "identity", icon: "◈", connected: false },
  { id: "azure-ad", name: "Azure AD", category: "identity", icon: "◈", connected: false },
  { id: "google-ws", name: "Google Workspace", category: "identity", icon: "◈", connected: false },
  { id: "splunk", name: "Splunk", category: "siem", icon: "◉", connected: false },
  { id: "datadog", name: "Datadog", category: "siem", icon: "◉", connected: true },
  { id: "elastic", name: "Elastic", category: "siem", icon: "◉", connected: false },
  { id: "drata", name: "Drata", category: "compliance", icon: "◎", connected: false },
  { id: "vanta", name: "Vanta", category: "compliance", icon: "◎", connected: true },
  { id: "secureframe", name: "Secureframe", category: "compliance", icon: "◎", connected: false },
];

export const trendData = [
  { date: "Mar 10", critical: 12, high: 18, medium: 22, low: 30 },
  { date: "Mar 17", critical: 10, high: 20, medium: 25, low: 28 },
  { date: "Mar 24", critical: 15, high: 19, medium: 23, low: 32 },
  { date: "Mar 31", critical: 13, high: 22, medium: 20, low: 29 },
  { date: "Apr 07", critical: 15, high: 24, medium: 32, low: 48 },
];
