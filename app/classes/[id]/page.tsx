import { redirect } from "next/navigation"

export default async function ClassIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/classes/${id}/roster`)
}
