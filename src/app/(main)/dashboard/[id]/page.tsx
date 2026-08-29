import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { getAuthUser } from "@/lib/auth";
import { BusinessMember } from "@/server/models/Business";
import { memberRole } from "@/services/business.service";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Business dashboard" };

export default async function DashboardPage({ params }: Props) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  const user = await getAuthUser();
  if (!user) redirect(`/login?next=/dashboard/${id}`);

  const membership = await BusinessMember.exists({ businessId: id, userId: user._id });
  if (!membership && user.role !== "admin") notFound();

  const role = await memberRole(user, id);

  return <DashboardClient businessId={id} canManage={role.canManage} />;
}
