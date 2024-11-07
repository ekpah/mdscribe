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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import prisma from "@/lib/prisma";
import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import editTemplate from "../_actions/edit-template";
import TipTap from "./TipTap";

export default function SkeletonEditor() {
  return (
    <Card className="flex flex-col gap-4 h-[calc(100vh-theme(spacing.16)-theme(spacing.10)-2rem)] w-full overflow-y-auto p-4">
      <div className="grow gap-2">
        <div className="flex flex-col grow md:flex-row gap-2">
          <div className="flex-1 w-full">
            <Label htmlFor="category">Kategorie</Label>
            <Skeleton className="w-[500px] h-[20px] rounded-full" />
          </div>

          <div className="flex-1">
            <Label htmlFor="name">Name</Label>
            <Skeleton className="w-[500px] h-[20px] rounded-full" />
          </div>
        </div>

        <div className="grow gap-2">
          <Label htmlFor="editor">Inhalt</Label>
          <Skeleton className="w-full h-[calc(100vh-theme(spacing.72)-theme(spacing.6))] rounded-l" />
        </div>
        <Button type="submit" className="w-full mt-2">
          Textbaustein speichern
        </Button>
      </div>
    </Card>
  );
}
