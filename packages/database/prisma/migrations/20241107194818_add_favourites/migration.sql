-- CreateTable
CREATE TABLE "_favourites" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_favourites_AB_unique" ON "_favourites"("A", "B");

-- CreateIndex
CREATE INDEX "_favourites_B_index" ON "_favourites"("B");

-- AddForeignKey
ALTER TABLE "_favourites" ADD CONSTRAINT "_favourites_A_fkey" FOREIGN KEY ("A") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_favourites" ADD CONSTRAINT "_favourites_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
