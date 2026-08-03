import { ForgotPasswordForm } from '../_components/forgot-password-form';

export const metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">Account</p>
      <h1 className="mt-4 max-w-measure text-display-sm sm:text-display-md">
        Forgotten your <em className="bm-emphasis">password</em>?
      </h1>
      <p className="mt-4 max-w-measure text-mute">
        Enter your email and we&rsquo;ll send a link to choose a new one.
      </p>

      <ForgotPasswordForm />
    </div>
  );
}
