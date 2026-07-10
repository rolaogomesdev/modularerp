"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage, Button, Spinner } from "@repo/ui";

import { saveAvatarUrl } from "@/lib/actions/profile";
import { createClient } from "@/lib/supabase/client";

export function AvatarUploader({
  userId,
  avatarUrl,
  displayName,
}: {
  userId: string;
  avatarUrl: string | null;
  displayName: string;
}) {
  const t = useTranslations("profile.identity");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file after a failure
    if (!file) return;
    setPending(true);
    setFailed(false);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: false });
    if (error) {
      setFailed(true);
      setPending(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const result = await saveAvatarUrl(data.publicUrl);
    if (result && "errorKey" in result) {
      setFailed(true);
    } else if (avatarUrl) {
      // best-effort cleanup: superseded avatars shouldn't live forever at
      // public URLs — remove the previous object if it was ours
      const marker = "/storage/v1/object/public/avatars/";
      const index = avatarUrl.indexOf(marker);
      if (index !== -1) {
        const oldPath = avatarUrl.slice(index + marker.length);
        if (oldPath.startsWith(`${userId}/`)) {
          await supabase.storage.from("avatars").remove([oldPath]);
        }
      }
    }
    setPending(false);
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          aria-label={t("changeAvatar")}
          className="sr-only"
          onChange={onFile}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? <Spinner size="sm" label={t("uploading")} /> : t("changeAvatar")}
        </Button>
        {failed ? (
          <p role="alert" className="text-xs text-danger">
            {t("avatarFailed")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
