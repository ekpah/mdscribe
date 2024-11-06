import Editor from "./_components/Editor";

export default function Loading({ params }) {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <Editor
      cat={"Kategorie..."}
      tit={"Titel..."}
      note={JSON.stringify("Inhalt...")}
      id={""}
      authorId={""}
    />
  );
}
