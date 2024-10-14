import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Doctors from "@/public/landing/Doctors";
import { HeroDivider } from "@/public/landing/HeroDivider";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { useState } from "react";

export default function Hero() {
  const [filterTerm, setFilterTerm] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    redirect("/templates/cm27xjij0000atvlt77tdkvrl?filter=" + filterTerm);
  };
  return (
    <div className="flex flex-col flex-wrap items-center px-3 md:flex-row h-[screen]">
      {/*<!--Left Col-->*/}
      <div className="flex w-full flex-col items-start justify-center px-3 py-6 text-center md:w-2/5 md:py-3 md:text-left">
        <p className="tracking-loose w-full uppercase">
          Warum kann es nicht einfach sein?
        </p>
        <h1 className="my-4 text-5xl font-bold leading-tight">
          Arztbriefe erstellen ohne sich zu wiederholen
        </h1>
        <p className="mb-8 text-2xl leading-normal">
          Nutze schlaue Textbausteine, die sich ohne viel Aufwand immer wieder
          verwenden lassen
        </p>
        <form
          className="flex flex-row"
          action="/templates/cm27xjij0000atvlt77tdkvrl?filter="
        >
          <Input
            className="mx-4"
            value={filterTerm}
            name="filter"
            onChange={(e) => setFilterTerm(e.target.value)}
          />{" "}
          <Button
            type="submit"
            variant="secondary"
            className="self-center rounded-full px-8 py-4 font-bold shadow-lg transition duration-300 ease-in-out hover:scale-105 focus:outline-none md:self-start lg:mx-0"
          >
            <Link
              href={{
                pathname: "/templates/cm27xjij0000atvlt77tdkvrl",
                query: { filter: filterTerm },
              }}
            >
              Ausprobieren
            </Link>
          </Button>
        </form>
      </div>
      {/*<!--Right Col-->*/}
      <div className="w-full text-center md:w-3/5">
        <Doctors />
      </div>
      {/* 
        div className="relative -mt-12 lg:-mt-24">
        <HeroDivider />
      </div>*/}
    </div>
  );
}
