ALTER TABLE "AiDefaults" ADD COLUMN "aiScribeCollectionId" text REFERENCES "TemplateCollection"("id") ON DELETE SET NULL;
