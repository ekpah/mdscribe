import SkeletonContentSection from "./_components/SkeletonContentSection";

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <div className="flex flex-col w-full h-full">
      <SkeletonContentSection />
    </div>
  );
}
