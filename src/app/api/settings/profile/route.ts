import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validation";
import { User } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(req, updateProfileSchema);

  const $set: Record<string, unknown> = {};
  for (const key of ["name", "bio", "country", "city", "avatarKey"] as const) {
    if (input[key] !== undefined) $set[key] = input[key];
  }
  if (input.allowCalls !== undefined) $set["settings.allowCalls"] = input.allowCalls;
  if (input.allowMessagesFromAnyone !== undefined) $set["settings.allowMessagesFromAnyone"] = input.allowMessagesFromAnyone;
  if (input.notifications) {
    for (const [type, enabled] of Object.entries(input.notifications)) {
      $set[`settings.notifications.${type}`] = enabled;
    }
  }

  await User.updateOne({ _id: user._id }, { $set });
  return ok({ updated: true });
});
