import { CompareView } from "@/components/workspace/compare-view";

export default async function ComparePage(props: PageProps<"/app/compare/[id]">) {
  const { id } = await props.params;
  return <CompareView id={id} />;
}
