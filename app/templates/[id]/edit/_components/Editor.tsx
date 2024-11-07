"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import editTemplate from "../_actions/edit-template";
import TipTap from "./TipTap";

export default function Editor({ cat, tit, note, id, authorId }) {
  const [category, setCategory] = useState(cat);
  const [name, setName] = useState(tit);
  const [content, setContent] = useState(JSON.parse(note));
  const [newCategory, setNewCategory] = useState("");
  const existingCategories = [
    "Kardiologie",
    "Gastroenterologie",
    "Diverses",
    "Onkologie",
  ];
  const [activeTab, setActiveTab] = useState("edit");
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await editTemplate(formData);
    toast.success("Vorlage gespeichert"); // Displays a success message
    redirect(`/templates/${formData.get("id") as string}`);
  }

  return (
    <Card className="flex flex-col gap-4 h-[calc(100vh-theme(spacing.16)-theme(spacing.10)-2rem)] overflow-y-auto p-4">
      <form onSubmit={onSubmit} className="grow gap-2">
        <div className="flex flex-col grow md:flex-row gap-2">
          <div className="flex-1 w-full">
            <Label htmlFor="category">Kategorie</Label>
            <input
              type="hidden"
              name="category"
              value={category === "new" ? newCategory : category}
            />
            <Select onValueChange={setCategory} value={category}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {existingCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem value="new">Neue Kategorie hinzufügen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {category === "new" && (
            <div className="flex-1">
              <Label htmlFor="newCategory">Neue Kategorie</Label>
              <Input
                id="newCategory"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Füge eine Kategorie hinzu"
              />
            </div>
          )}
          <div className="flex-1">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
            />
          </div>
        </div>

        <div className="grow gap-2">
          <Label htmlFor="editor">Inhalt</Label>
          <Textarea
            name="content"
            onChange={(e) => setContent(e.target.value)}
            value={content}
            className="w-full h-[calc(100vh-theme(spacing.72)-theme(spacing.6))] border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          {/*<Tabs value={activeTab} onValueChange={setActiveTab} className="grow">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="tiptap">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">
              <Textarea
                name="content"
                onChange={(e) => setContent(e.target.value)}
                value={content}
                className="w-full h-96 p-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </TabsContent>
            <TabsContent value="tiptap">
              <TabsContent value="tiptap">
                <Card className="border-secondary h-4/5 m-4 w-full h-96 p-4 border border-input rounded-md overflow-auto">
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
            </TabsContent>
          </Tabs>*/}
        </div>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="authorId" value={authorId} />
        <Button type="submit" className="w-full mt-2">
          Textbaustein speichern
        </Button>
      </form>
    </Card>
  );
}
