import { NextResponse } from "next/server";
import { getProjectRepository } from "@/database/project-repository";

export async function GET() {
  const repo = getProjectRepository();
  const projects = await repo.list();

  return NextResponse.json({ projects });
}