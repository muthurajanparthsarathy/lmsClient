"use client"

// Self-service profile editor: photo and password ONLY.
//
// Everything else on the profile (name, email, role, placement) is owned by
// User Management — it decides who a person is in the institution, so it is not
// editable from the person's own page. These two are the exceptions: a photo is
// cosmetic, and a password is the one field only its owner should set.

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Camera, Eye, EyeOff, KeyRound, Loader2, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getToken } from "@/lib/session"
import { updateMyProfile } from "@/app/lms/pages/usermanagement/api/userService"

// Matches what the server's Supabase upload will accept, and keeps a 20 MB
// camera roll photo from being sent only to be rejected.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]

interface Props {
  open: boolean
  onClose: () => void
  user: { _id: string; firstName: string; lastName: string; email: string; profile?: string }
  /** Called with the server's updated user so the page (and localStorage) can
   *  pick up the new photo without a reload. */
  onUpdated: (patch: { profile?: string; updatedAt?: string }) => void
}

const FIELD_CLS =
  "w-full h-10 px-3 pr-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 " +
  "placeholder:text-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 " +
  "transition-colors dark:bg-gray-900 dark:border-gray-700 dark:text-white"

function PasswordField({
  label, value, onChange, placeholder, autoComplete,
}: { label: string; value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={FIELD_CLS}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function EditProfileModal({ open, onClose, user, onUpdated }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Reset on every open so a cancelled edit never leaks into the next one.
  useEffect(() => {
    if (!open) return
    setPhoto(null); setPreview(null)
    setCurrent(""); setNext(""); setConfirm("")
    setSaving(false); setConfirmDiscard(false)
    if (fileRef.current) fileRef.current.value = ""
  }, [open])

  // Object URLs are a leak if they are never revoked; tie each one's life to
  // the File it was made from.
  useEffect(() => {
    if (!photo) { setPreview(null); return }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const pickPhoto = (f: File | null) => {
    if (!f) return
    if (!PHOTO_TYPES.includes(f.type)) {
      toast.error(`${f.name} — must be a JPG, PNG or WebP image`, { position: "top-right" })
      if (fileRef.current) fileRef.current.value = ""
      return
    }
    if (f.size > MAX_PHOTO_BYTES) {
      toast.error(`${f.name} — larger than the 5MB limit`, { position: "top-right" })
      if (fileRef.current) fileRef.current.value = ""
      return
    }
    setPhoto(f)
  }

  const wantsPassword = Boolean(current || next || confirm)
  const isDirty = Boolean(photo) || wantsPassword

  // One reason string, so the button's disabled state and the hint under the
  // form can never disagree about why saving is blocked.
  const blocked = (() => {
    if (!isDirty) return "Choose a new photo or set a new password."
    if (wantsPassword) {
      if (!current) return "Enter your current password."
      if (!next) return "Enter a new password."
      if (next.length < 8) return "New password must be at least 8 characters."
      if (next === current) return "New password must differ from the current one."
      if (next !== confirm) return "New password and confirmation do not match."
    }
    return null
  })()

  const handleSave = async () => {
    if (blocked) return
    const token = getToken()
    if (!token) { toast.error("Session ended — please log in again", { position: "top-right" }); return }

    setSaving(true)
    try {
      const res = await updateMyProfile(
        {
          photo,
          ...(wantsPassword ? { currentPassword: current, newPassword: next } : {}),
        },
        token
      )
      toast.success(res?.message?.[0]?.value || "Profile updated", { position: "top-right" })
      onUpdated({ profile: res?.user?.profile, updatedAt: res?.user?.updatedAt })
      onClose()
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile", { position: "top-right" })
    } finally {
      setSaving(false)
    }
  }

  const requestClose = () => {
    if (saving) return
    if (isDirty) { setConfirmDiscard(true); return }
    onClose()
  }

  const shownImage = preview || (user.profile && user.profile !== "default" ? user.profile : null)
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) requestClose() }}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-[460px] p-0 gap-0 overflow-hidden rounded-2xl"
      >
        <DialogHeader className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-base font-black text-gray-900 dark:text-white">Edit Profile</DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Update your photo or password. Name, email and role are managed in User Management.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={saving}
              title="Close"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition-colors duration-150 hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <X className="h-4 w-4" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-5">

          {/* ── Photo ── */}
          <div>
            <p className="mb-2.5 text-[11px] font-black uppercase tracking-wider text-gray-400">Profile photo</p>
            <div className="flex items-center gap-4">
              <div
                className="h-20 w-20 flex-shrink-0 rounded-full p-[3px] shadow-md shadow-orange-500/20"
                style={{ background: "linear-gradient(135deg,#C4B5FD,#FDBA74 55%,#F97316)" }}
              >
                <div className="h-full w-full rounded-full bg-white p-[2px] dark:bg-gray-900">
                  <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-gradient-to-br from-orange-200 to-orange-400">
                    {shownImage ? (
                      // A plain <img> for the blob: preview — next/image would
                      // need the object URL whitelisted as a remote pattern.
                      preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="New profile photo" className="h-full w-full object-cover" />
                      ) : (
                        <Image src={shownImage} alt={user.firstName} width={80} height={80} className="h-full w-full object-cover" />
                      )
                    ) : (
                      <span className="text-2xl font-black text-white">{initials}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => pickPhoto(e.target.files?.[0] || null)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                  >
                    <Camera className="h-3.5 w-3.5" /> Change photo
                  </Button>
                  {photo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = "" }}
                      disabled={saving}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <p className="mt-1.5 truncate text-[11px] text-gray-400">
                  {photo ? photo.name : "JPG, PNG or WebP · up to 5MB"}
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* ── Password ── */}
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-orange-50 dark:bg-orange-950/40">
                <KeyRound className="h-3 w-3 text-orange-500" />
              </span>
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Change password</p>
              <span className="text-[11px] font-medium text-gray-300">optional</span>
            </div>
            <div className="space-y-3">
              <PasswordField
                label="Current password"
                value={current}
                onChange={setCurrent}
                placeholder="Your current password"
                autoComplete="current-password"
              />
              <PasswordField
                label="New password"
                value={next}
                onChange={setNext}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirm new password"
                value={confirm}
                onChange={setConfirm}
                placeholder="Repeat the new password"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-gray-100 bg-gray-50/60 px-5 py-3 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-[11px] text-gray-400">{blocked || "Ready to save."}</p>
            <div className="flex flex-shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={requestClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || Boolean(blocked)}
                className="gap-1.5 bg-orange-500 text-white hover:bg-orange-600"
              >
                {saving
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  : <><Save className="h-3.5 w-3.5" /> Save changes</>}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Discard confirmation — only when something has been entered */}
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Discard these changes?</DialogTitle>
            <DialogDescription>
              {photo && wantsPassword
                ? "Your new photo and password entry will be cleared."
                : photo
                  ? "Your new photo will be cleared."
                  : "Your password entry will be cleared."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => { setConfirmDiscard(false); onClose() }}
            >
              Discard &amp; close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
