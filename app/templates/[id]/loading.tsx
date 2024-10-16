import { Skeleton } from "@/components/ui/skeleton";
import ContentSection from "./_components/ContentSection";

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  <ContentSection
    inputTags={JSON.stringify([])}
    note={JSON.stringify("Loading...")}
  />;
}
