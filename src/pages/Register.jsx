import React, { useState } from "react";
import { Link } from "react-router-dom";
import { signUp, resendSignupOtp, loginWithProvider } from "@/lib/supabaseAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import AppleIcon from "@/components/AppleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState("driver");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCheckEmail, setShowCheckEmail] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      // Picked up by AccountProfile.jsx's onboarding step once the driver
      // confirms via the emailed link and lands there — same handoff the
      // Google/Apple paths below already use.
      sessionStorage.setItem('drivebid_signup_role', accountType);
      await signUp(email, password);
      setShowCheckEmail(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await resendSignupOtp(email);
      toast({
        title: "Email sent",
        description: "Check your inbox for the confirmation link.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend email");
    }
  };

  const handleGoogle = () => {
    sessionStorage.setItem('drivebid_signup_role', accountType);
    loginWithProvider("google", window.location.origin + "/profile?onboarding=1");
  };

  const handleApple = () => {
    sessionStorage.setItem('drivebid_signup_role', accountType);
    loginWithProvider("apple", window.location.origin + "/profile?onboarding=1");
  };

  if (showCheckEmail) {
    return (
      <AuthLayout
        icon={Mail}
        title="Check your email"
        subtitle={`We sent a confirmation link to ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <p className="text-sm text-foreground text-center mb-6">
          Click the link in that email to finish creating your account. You can close this tab.
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Didn't receive it?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-primary font-medium hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <div className="mb-6">
        <Label>I am joining as a</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Button type="button" variant={accountType === 'driver' ? 'default' : 'outline'} onClick={() => setAccountType('driver')}>Driver</Button>
          <Button type="button" variant={accountType === 'broker' ? 'default' : 'outline'} onClick={() => setAccountType('broker')}>Broker</Button>
          <Button type="button" variant={accountType === 'individual' ? 'default' : 'outline'} onClick={() => setAccountType('individual')}>Individual</Button>
        </div>
      </div>
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-3"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleApple}
      >
        <AppleIcon className="w-5 h-5 mr-2" />
        Continue with Apple
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-4">
          By creating an account, you agree to Relay's{" "}
          <Link to="/terms" className="text-primary font-medium hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link to="/privacy" className="text-primary font-medium hover:underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthLayout>
  );
}
