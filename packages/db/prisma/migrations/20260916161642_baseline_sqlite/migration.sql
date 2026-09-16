-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "githubInstallationId" TEXT,
    "githubAppConnected" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME,
    "updatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIALIZING',
    "repoFullName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "mainModel" TEXT,
    "workspacePath" TEXT,
    "initStatus" TEXT NOT NULL DEFAULT 'INACTIVE',
    "scheduledCleanupAt" DATETIME,
    "initializationError" TEXT,
    "errorMessage" TEXT,
    "workspaceCleanedUp" BOOLEAN NOT NULL DEFAULT false,
    "hasBeenInitialized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "baseCommitSha" TEXT NOT NULL,
    "shadowBranch" TEXT NOT NULL,
    "pullRequestNumber" INTEGER,
    "githubIssueId" TEXT,
    "codebaseUnderstandingId" TEXT,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_codebaseUnderstandingId_fkey" FOREIGN KEY ("codebaseUnderstandingId") REFERENCES "CodebaseUnderstanding" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "repository_index" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoFullName" TEXT NOT NULL,
    "lastIndexedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCommitSha" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Todo" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sequence" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "taskId" TEXT NOT NULL,

    PRIMARY KEY ("taskId", "id"),
    CONSTRAINT "Todo_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "llmModel" TEXT NOT NULL,
    "metadata" JSONB,
    "sequence" INTEGER NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "finishReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" DATETIME,
    "taskId" TEXT NOT NULL,
    "stackedTaskId" TEXT,
    CONSTRAINT "ChatMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_stackedTaskId_fkey" FOREIGN KEY ("stackedTaskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "podName" TEXT,
    "podNamespace" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "taskId" TEXT NOT NULL,
    CONSTRAINT "TaskSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodebaseUnderstanding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoFullName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CodebaseUnderstanding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Memory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pull_request_snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "filesChanged" INTEGER NOT NULL,
    "linesAdded" INTEGER NOT NULL,
    "linesRemoved" INTEGER NOT NULL,
    "commitSha" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" TEXT NOT NULL,
    CONSTRAINT "pull_request_snapshot_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "memoriesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPullRequest" BOOLEAN NOT NULL DEFAULT false,
    "enableShadowWiki" BOOLEAN NOT NULL DEFAULT true,
    "enableIndexing" BOOLEAN NOT NULL DEFAULT false,
    "selectedModels" TEXT NOT NULL DEFAULT '[]',
    "rules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "repository_index_repoFullName_key" ON "repository_index"("repoFullName");

-- CreateIndex
CREATE INDEX "repository_index_repoFullName_idx" ON "repository_index"("repoFullName");

-- CreateIndex
CREATE INDEX "Todo_taskId_sequence_idx" ON "Todo"("taskId", "sequence");

-- CreateIndex
CREATE INDEX "Todo_taskId_status_idx" ON "Todo"("taskId", "status");

-- CreateIndex
CREATE INDEX "ChatMessage_taskId_sequence_idx" ON "ChatMessage"("taskId", "sequence");

-- CreateIndex
CREATE INDEX "ChatMessage_taskId_role_sequence_idx" ON "ChatMessage"("taskId", "role", "sequence");

-- CreateIndex
CREATE INDEX "ChatMessage_llmModel_createdAt_idx" ON "ChatMessage"("llmModel", "createdAt");

-- CreateIndex
CREATE INDEX "TaskSession_taskId_isActive_idx" ON "TaskSession"("taskId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CodebaseUnderstanding_repoFullName_key" ON "CodebaseUnderstanding"("repoFullName");

-- CreateIndex
CREATE INDEX "CodebaseUnderstanding_repoFullName_idx" ON "CodebaseUnderstanding"("repoFullName");

-- CreateIndex
CREATE INDEX "Memory_userId_repoFullName_idx" ON "Memory"("userId", "repoFullName");

-- CreateIndex
CREATE INDEX "Memory_taskId_idx" ON "Memory"("taskId");

-- CreateIndex
CREATE INDEX "Memory_category_idx" ON "Memory"("category");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_snapshot_messageId_key" ON "pull_request_snapshot"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");
