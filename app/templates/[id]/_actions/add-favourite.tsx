"use server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import toast from "react-hot-toast";

export default async function addFavourite(template) {
  "use server";
  const session = await auth();
  const res = await prisma.template.update({
    where: {
      id: template.id,
    },
    data: {
      favouriteOf: {
        connect: { id: session?.user?.id },
      },
    },
  });
  return res;
}
