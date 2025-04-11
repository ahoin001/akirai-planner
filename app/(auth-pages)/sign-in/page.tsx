import { signInAction, signInWithGoogle } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import GoogleButton from "@/components/googlebutton";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;

  return (
    <div className="flex flex-col items-center justify-center w-full h-screen px-4 py-8 text-white md:py-12">
      <div className="w-full max-w-sm md:max-w-md">
        <div className="space-y-2 mb-6">
          <h1 className="text-center text-2xl font-medium md:text-3xl">
            Sign in
          </h1>
          <p className="text-sm text-center text-foreground">
            Don't have an account?{" "}
            <Link
              className="text-foreground text-rose-500 font-medium underline"
              href="/sign-up"
            >
              Sign up
            </Link>
          </p>
        </div>

        {/* Email/Password Form */}
        <form className="flex flex-col space-y-6">
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
            className="w-full mt-6"
          >
            Sign in with Email
          </SubmitButton>
        </form>

        <div className="mt-6">
          <FormMessage message={searchParams} />
        </div>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-3 text-gray-500 text-sm">OR</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Google Sign-In */}
        <form>
          {/* <SubmitButton
            pendingText="Redirecting..."
            formAction={signInWithGoogle}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            Sign in with Google
          </SubmitButton> */}
          <div className="w-full flex justify-center mb-6">
            <GoogleButton onClick={signInWithGoogle} />
          </div>
        </form>
      </div>
      <div className="invisible">
        <SmtpMessage />
      </div>
    </div>
  );
}
