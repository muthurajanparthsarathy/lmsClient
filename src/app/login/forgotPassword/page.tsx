
"use client";
 
import { useState } from "react";
import {
  MailCheckIcon,
  ShieldCheckIcon,
  KeyRoundIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  MailIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
 
function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
 
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
          autoComplete={id}
          required
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
        >
          {show ? (
            <EyeOffIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
          <span className="sr-only">
            {show ? "Hide password" : "Show password"}
          </span>
        </Button>
      </div>
    </div>
  );
}
 
export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"forgotpassword" | "otp" | "reset" | "done">(
    "forgotpassword"
  );
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
 
  const OTP_LENGTH = 6;
 
  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.length !== OTP_LENGTH) {
      setError("Please enter the 6-digit code sent to your email.");
      return;
    }
    // TODO: Validate OTP here
    setStep("reset");
  }
 
  function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    // TODO: Submit new password
    setStep("done");
  }
 
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement your submit logic here
    setSubmitted(true);
    setStep("otp");
  };
 
  // Image selection logic based on the step
  let sidebarImage = "";
  let sidebarAlt = "";
  let sidebarText = "";
  if (step === "forgotpassword") {
    sidebarImage = "/active-images/Forgotpassword2.svg";
    sidebarAlt = "forgotpassword";
    sidebarText = "Enter your email to verify your identity.";
  } else if (step === "otp") {
    sidebarImage = "/active-images/otp.svg";
    sidebarAlt = "OTP Verification Illustration";
    sidebarText = "Enter the code sent to your email to verify your identity.";
  } else if (step === "reset") {
    sidebarImage = "/active-images/Resetpassword.svg";
    sidebarAlt = "Reset Password Illustration";
    sidebarText = "Choose a strong new password to secure your account.";
  } else {
    sidebarImage = "/active-images/Completed.svg";
    sidebarAlt = "Success Illustration";
    sidebarText = "Your password has been reset successfully!";
  }
 
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="flex flex-col items-center gap-2 pb-0">
            {step === "forgotpassword" && (
              <MailIcon className="h-10 w-10 text-orange-600 mb-2" />
            )}
            {step === "otp" && (
              <MailCheckIcon className="h-10 w-10 text-orange-600 mb-2" />
            )}
            {step === "reset" && (
              <KeyRoundIcon className="h-10 w-10 text-orange-600 mb-2" />
            )}
            {step === "done" && (
              <ShieldCheckIcon className="h-10 w-10 text-green-600 mb-2" />
            )}
            <CardTitle className="text-2xl font-bold text-gray-900 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ease-in-out">
              {step === "forgotpassword" && "Forgot Password?"}
              {step === "otp" && "Enter Verification Code"}
              {step === "reset" && "Set a New Password"}
              {step === "done" && "Password Reset Successful"}
            </CardTitle>
            <CardDescription className="text-center text-gray-600 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ease-in-out">
              {step === "forgotpassword" && (
                <>
                  Enter your email address <br />
                  and we’ll send you a link to reset your password.{" "}
                </>
              )}
              {step === "otp" && (
                <>
                  We sent a 6-digit code to your email.
                  <br />
                  Please enter it below to verify your identity.
                </>
              )}
              {step === "reset" && (
                <>
                  Enter and confirm your new password.
                  <br />
                  Make sure it’s strong and unique.
                </>
              )}
              {step === "done" && (
                <>
                  Your password has been updated.
                  <br />
                  You can now sign in with your new password.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {error && (
              <div className="mb-4 text-sm text-red-600 font-medium text-center">
                {error}
              </div>
            )}
 
            {step === "forgotpassword" && (
              <>
                <form
                  className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ease-in-out"
                  onSubmit={handleSubmit}
                  autoComplete="email"
                >
                  <div>
                    <Label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Email address
                    </Label>
                    <div className="relative mt-2">
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                      <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    disabled={!email}
                  >
                    Send reset link
                    <ArrowRightIcon className="h-4 w-4" />
                  </Button>
                </form>
              </>
            )}
            {step === "otp" && (
              <form
                className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ease-in-out"
                onSubmit={handleOtpSubmit}
              >
                <Label
                  htmlFor="otp"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  6-digit code
                </Label>
                <InputOTP
                  maxLength={OTP_LENGTH}
                  value={otp}
                  onChange={setOtp}
                  pattern="^[0-9]+$"
                  className="justify-center"
                >
                  <InputOTPGroup className="flex gap-x-5">
                    {[...Array(OTP_LENGTH)].map((_, idx) => (
                      <InputOTPSlot
                        key={idx}
                        index={idx}
                        className="border border-gray-300 rounded"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                  disabled={otp.length !== OTP_LENGTH}
                >
                  Verify & Continue
                </Button>
                <div className="text-xs text-gray-500 text-center">
                  Didn’t get the code?{" "}
                  <span className="text-orange-600 hover:underline cursor-pointer">
                    Resend
                  </span>
                </div>
              </form>
            )}
 
            {step === "reset" && (
              <form
                className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ease-in-out"
                onSubmit={handleResetSubmit}
              >
                <PasswordInput
                  id="password"
                  label="New Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter new password"
                />
                <PasswordInput
                  id="confirm"
                  label="Confirm Password"
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="Re-enter new password"
                />
                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                  disabled={!password || !confirm}
                >
                  Reset Password
                </Button>
              </form>
            )}
 
            {step === "done" && (
              <div className="flex flex-col items-center gap-4 py-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ease-in-out">
                <div className="text-lg font-semibold text-gray-800">
                  All set!
                </div>
                <div className="text-sm text-gray-600 text-center">
                  Your password has been changed.
                  <br />
                  <a href="/login" className="text-orange-600 hover:underline">
                    Return to sign in
                  </a>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2 items-center border-t pt-4">
            <div className="text-xs text-gray-500">
              <span className="font-medium">Need help?</span>{" "}
              <a href="/support" className="text-orange-600 hover:underline">
                Contact support
              </a>
            </div>
            <div className="flex gap-2 text-xs text-gray-400">
              <span>© {new Date().getFullYear()} YourApp</span>
              <span>•</span>
              <a href="/privacy" className="hover:underline">
                Privacy
              </a>
              <span>•</span>
              <a href="/terms" className="hover:underline">
                Terms
              </a>
            </div>
          </CardFooter>
        </Card>
 
        {/* Sidebar image changes based on step */}
        <div className="hidden lg:flex flex-col items-center justify-center ml-16">
          <img
            src={sidebarImage}
            alt={sidebarAlt}
            className="w-72 h-auto opacity-90 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ease-in-out"
          />
          <div className="mt-4 text-gray-500 text-sm text-center max-w-xs animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ease-in-out">
            {sidebarText}
          </div>
        </div>
      </div>
    </>
  );
}
 