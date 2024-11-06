import { Prisma } from "@prisma/client";
import ContentSection from "./_components/ContentSection";

export default function Loading({ params }) {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <ContentSection
      template={{} as Prisma.TemplateGetPayload<{}>}
      inputTags={JSON.stringify({ infoTags: [], switchTags: [] })}
      note={JSON.stringify("Loading...")}
    />
  );
}
