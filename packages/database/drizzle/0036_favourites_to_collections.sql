-- Move each user's favourites into a "Favoriten" collection, then drop favourites.
WITH "favouriteCollection" AS (
	INSERT INTO "TemplateCollection" ("id", "userId", "name", "createdAt", "updatedAt")
	SELECT gen_random_uuid()::text, "userId", 'Favoriten', now(), now()
	FROM (SELECT DISTINCT "B" AS "userId" FROM "_favourites") AS "favouriteUser"
	RETURNING "id", "userId"
)
INSERT INTO "TemplateCollectionTemplate" ("collectionId", "templateId")
SELECT "favouriteCollection"."id", "_favourites"."A"
FROM "_favourites"
INNER JOIN "favouriteCollection" ON "favouriteCollection"."userId" = "_favourites"."B";
--> statement-breakpoint
DROP TABLE "_favourites";
