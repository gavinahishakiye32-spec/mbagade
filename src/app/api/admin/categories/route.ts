import { handle, ok, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { categoryUpsertSchema } from "@/lib/validation";
import { Category } from "@/server/models";
import { auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await connectDB();
  await requireAdmin();
  const categories = await Category.find().sort({ order: 1 }).lean();
  return ok({
    items: categories.map((c) => ({
      id: String(c._id),
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      active: c.active,
      order: c.order,
    })),
  });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const input = await parseJson(req, categoryUpsertSchema);
  await Category.updateOne({ slug: input.slug }, input, { upsert: true });
  await auditLog(String(admin._id), "category.upsert", "category", null, { slug: input.slug });
  return ok({ saved: true });
});
