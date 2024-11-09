"use server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import toast from "react-hot-toast";

export default async function removeFavourite(template) {
  "use server";
  const session = await auth();
  console.log(template);
  const res = await prisma.template.update({
    where: {
      id: template.id,
    },
    data: {
      favouriteOf: {
        disconnect: { id: session?.user?.id },
      },
    },
  });
  return res;
}
