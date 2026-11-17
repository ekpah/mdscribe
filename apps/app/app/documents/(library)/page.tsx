import { redirect } from "next/navigation";

export default function DocumentsPage() {
	redirect("/templates?type=pdf");
}
