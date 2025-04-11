import { signInAction, signInWithGoogle } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;

  return (
    <div className="flex flex-col items-center justify-center w-full bg-red-100 px-4 py-8 text-white md:py-12">
      <div className="w-full max-w-sm md:max-w-md">
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl font-medium md:text-3xl">Sign in</h1>
          <p className="text-sm text-foreground">
            Don't have an account?{" "}
            <Link
              className="text-foreground font-medium underline"
              href="/sign-up"
            >
              Sign up
            </Link>
          </p>
        </div>

        {/* Email/Password Form */}
        <form className="flex flex-col space-y-4 mb-8">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              placeholder="you@example.com"
              required
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Password</Label>
              <Link
                className="text-xs text-foreground underline hover:text-primary"
                href="/forgot-password"
              >
                Forgot Password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              name="password"
              placeholder="Your password"
              required
              className="w-full"
            />
          </div>

          <SubmitButton
            pendingText="Signing In..."
            formAction={signInAction}
            className="w-full mt-2 bg-primary hover:bg-primary-dark"
          >
            Sign in with Email
          </SubmitButton>

          <FormMessage message={searchParams} />
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-3 text-gray-500 text-sm">OR</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Google Sign-In */}
        <form>
          <SubmitButton
            pendingText="Redirecting..."
            formAction={signInWithGoogle}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            Sign in with Google
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
