"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import prisma from "@/lib/prisma";
import createTemplate from "../_actions/create-template";

import { useState } from "react";
import TipTap from "./TipTap";

export default function Editor({ cat, tit, note }) {
  const [category, setCategory] = useState(cat);
  const [name, setName] = useState(tit);
  console.log(note);
  const [content, setContent] = useState(JSON.parse(note));

  return (
    <Card className="w-2/3 h-2/3 flex flex-col items-center justify-center">
      <form className="w-full h-full" action={createTemplate}>
        <Input
          className="border-secondary"
          placeholder="Kategorie"
          name="category"
          onChange={(e) => setCategory(e.target.value)}
          value={category}
        />
        <Input
          className="border-secondary"
          placeholder="Name"
          name="name"
          onChange={(e) => setName(e.target.value)}
          value={name}
        />
        <Tabs defaultValue="plain" className="w-full h-2/3">
          <TabsList className="self-center">
            <TabsTrigger value="plain">Text</TabsTrigger>
            <TabsTrigger value="tiptap">WYSIWYG</TabsTrigger>
          </TabsList>
          <TabsContent className="h-full" value="plain">
            <Textarea
              name="content"
              onChange={(e) => setContent(e.target.value)}
              value={content}
              className="h-4/5"
            />
            <div className="flex flex-row p-2">
              <Button variant="secondary" className="m-4">
                Abbrechen
              </Button>
              <Button type="submit" className="m-4">
                Speichern
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="tiptap">
            <Card className="border-secondary h-4/5 m-4">
              <TipTap note={JSON.stringify(content)} />
            </Card>
            <div className="flex flex-row p-2">
              <Button variant="secondary" className="m-4">
                Abbrechen
              </Button>
              <Button type="submit" className="m-4">
                Speichern
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </form>
    </Card>
  );
}
