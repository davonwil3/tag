-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "conditionValue" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rule_shop_idx" ON "Rule"("shop");

-- CreateIndex
CREATE INDEX "Rule_appliesTo_idx" ON "Rule"("appliesTo");
