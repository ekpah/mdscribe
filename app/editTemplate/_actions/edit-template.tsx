"use server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import toast from "react-hot-toast";

export default async function editTemplate(formData: FormData) {
  "use server";
  const session = await auth();

  // handle submitting the template to save it to prisma (Neon-Postgres)
  const rawFormData = {
    id: formData.get("id") as string,
    category: formData.get("category") as string,
    name: formData.get("name") as string,
    content: formData.get("content") as string,
    authorId: formData.get("authorId") as string,
  };

  if (rawFormData.authorId !== session?.user?.id) {
    console.log(rawFormData.authorId, session?.user?.id);
    throw new Error("Permission denied");
  }
  await prisma.template.update({
    where: {
      id: rawFormData.id,
    },
    data: {
      category: rawFormData.category,
      title: rawFormData.name,
      content: rawFormData.content,
      author: {
        connect: {
          id: session?.user?.id as string, // Assuming session.user.id exists and is the correct user ID
        },
      },
    },
  });
}
