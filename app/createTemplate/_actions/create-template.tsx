"use server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export default async function createTemplate(formData: FormData) {
  "use server";
  const session = await auth();

  // handle submitting the template to save it to prisma (Neon-Postgres)
  const rawFormData = {
    category: formData.get("category") as string,
    name: formData.get("name") as string,
    content: formData.get("content") as string,
  };
  await prisma.template.create({
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
