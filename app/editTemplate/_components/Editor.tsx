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
    console.log("Saving template:", {
      category: category || newCategory,
      name,
      content,
    });
    const formData = new FormData(event.currentTarget);
    await editTemplate(formData);
    toast.success("Vorlage gespeichert"); // Displays a success message
  }

  return (
    <Card className="w-2/3 h-2/3 items-center justify-center">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold mb-6">Edit Text Template</h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="category">Category</Label>
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
                  <SelectItem value="new">Add new category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {category === "new" && (
              <div className="flex-1">
                <Label htmlFor="newCategory">New Category</Label>
                <Input
                  id="newCategory"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Enter new category"
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

          <div>
            <Label htmlFor="editor">Content</Label>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit">Edit</TabsTrigger>
                {/*<TabsTrigger value="preview">Preview</TabsTrigger>*/}
              </TabsList>
              <TabsContent value="edit">
                <Textarea
                  name="content"
                  onChange={(e) => setContent(e.target.value)}
                  value={content}
                  className="h-4/5 w-full h-96 p-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="w-full h-96 p-4 border border-input rounded-md overflow-auto bg-white">
                  {/*<TabsContent value="tiptap">
            <Card className="border-secondary h-4/5 m-4 w-full h-96 p-4 border border-input rounded-md overflow-auto bg-white">
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
          </TabsContent>*/}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="authorId" value={authorId} />
          <Button type="submit" className="w-full">
            Save Template
          </Button>
        </form>
      </div>
    </Card>
  );
}
