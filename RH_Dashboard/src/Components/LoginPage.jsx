import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { Lock, ShieldCheck, TrendingUp, User, WalletCards } from "lucide-react";
import BrandMark from "./Shell/BrandMark";

const MFA_REQUIRED_MESSAGE =
  "Robinhood needs phone approval. Approve the prompt in the Robinhood app, then keep this page open.";
const MFA_CODE_REQUIRED_MESSAGE =
  "Robinhood requires an MFA code. Enter the current code, then press Log in again.";
const MFA_PENDING_MESSAGE =
  "Robinhood is waiting for phone approval. Check your Robinhood app and approve the prompt to continue.";

const isMfaRequiredError = (error) =>
  Boolean(
    error?.mfaRequired ||
      error?.data?.mfa_required ||
      error?.code === "mfa_required" ||
      error?.code === "mfa_code_required" ||
      error?.status === 409,
  );

const isMfaCodeRequiredError = (error) =>
  Boolean(
    error?.mfaCodeRequired ||
      error?.data?.mfa_code_required ||
      error?.code === "mfa_code_required",
  );

const LoginPage = ({ error, mfaRequired = false, onLogin }) => {
  const [formValues, setFormValues] = useState({
    username: "",
    password: "",
    mfa_code: "",
  });
  const [formError, setFormError] = useState(null);
  const [loginRequiresMfa, setLoginRequiresMfa] = useState(false);
  const [loginRequiresMfaCode, setLoginRequiresMfaCode] = useState(false);
  const [showPendingMfaHint, setShowPendingMfaHint] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showMfaMessage = mfaRequired || loginRequiresMfa;
  let loginMessage = formError || error;
  if (showPendingMfaHint) {
    loginMessage = MFA_PENDING_MESSAGE;
  }
  if (showMfaMessage) {
    loginMessage = MFA_REQUIRED_MESSAGE;
  }
  if (loginRequiresMfaCode) {
    loginMessage = MFA_CODE_REQUIRED_MESSAGE;
  }
  const loginMessageVariant =
    showMfaMessage || showPendingMfaHint || loginRequiresMfaCode ? "warning" : "danger";

  useEffect(() => {
    if (!isSubmitting) {
      setShowPendingMfaHint(false);
      return undefined;
    }

    const pendingMfaTimer = window.setTimeout(() => {
      setShowPendingMfaHint(true);
    }, 1500);

    return () => {
      window.clearTimeout(pendingMfaTimer);
    };
  }, [isSubmitting]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    setLoginRequiresMfa(false);
    setLoginRequiresMfaCode(false);
    setShowPendingMfaHint(false);

    if (!formValues.username.trim() || !formValues.password) {
      setFormError("Enter your Robinhood username and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await onLogin({
        username: formValues.username,
        password: formValues.password,
        mfa_code: formValues.mfa_code.trim() || undefined,
      });
    } catch (loginError) {
      if (isMfaCodeRequiredError(loginError)) {
        setLoginRequiresMfaCode(true);
        setFormError(MFA_CODE_REQUIRED_MESSAGE);
      } else if (isMfaRequiredError(loginError)) {
        setLoginRequiresMfa(true);
        setFormError(MFA_REQUIRED_MESSAGE);
      } else {
        setFormError(loginError.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page vault-login-page">
      <section className="login-story-panel" aria-label="Dividend Vault benefits">
        <BrandMark />
        <div className="login-story-copy">
          <h1>
            Track your portfolio. Understand your <span>dividend income.</span>
          </h1>
          <div className="login-benefits">
            <article>
              <span aria-hidden="true">
                <TrendingUp size={28} />
              </span>
              <div>
                <strong>Portfolio allocation and performance</strong>
                <p>See how your holdings are positioned and performing.</p>
              </div>
            </article>
            <article>
              <span aria-hidden="true">
                <WalletCards size={28} />
              </span>
              <div>
                <strong>Dividend income tracking</strong>
                <p>Monitor income, yield, and growth over time.</p>
              </div>
            </article>
            <article>
              <span aria-hidden="true">
                <ShieldCheck size={28} />
              </span>
              <div>
                <strong>Secure Robinhood data sync</strong>
                <p>Connect once. Your credentials stay local to this app flow.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="login-form-panel" aria-label="Sign in">
        <Card className="login-card vault-login-card">
          <Card.Body>
            <div className="login-card-brand">
              <BrandMark compact />
            </div>
            <div className="login-header">
              <h1>Sign in</h1>
              <p>Access your Dividend Vault dashboard</p>
            </div>

            {loginMessage && (
              <Alert className="login-alert" variant={loginMessageVariant}>
                {loginMessage}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="vault-form-group" controlId="robinhood-username">
                <Form.Label>Email or username</Form.Label>
                <div className="vault-input-shell">
                  <User size={19} aria-hidden="true" />
                  <Form.Control
                    autoComplete="username"
                    disabled={isSubmitting}
                    name="username"
                    onChange={handleChange}
                    placeholder="Enter your email or username"
                    type="text"
                    value={formValues.username}
                  />
                </div>
              </Form.Group>

              <Form.Group className="vault-form-group" controlId="robinhood-password">
                <Form.Label>Password</Form.Label>
                <div className="vault-input-shell">
                  <Lock size={19} aria-hidden="true" />
                  <Form.Control
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    name="password"
                    onChange={handleChange}
                    placeholder="Enter your password"
                    type="password"
                    value={formValues.password}
                  />
                </div>
              </Form.Group>

              <Form.Group className="vault-form-group" controlId="robinhood-mfa">
                <Form.Label>MFA code</Form.Label>
                <div className="vault-input-shell">
                  <ShieldCheck size={19} aria-hidden="true" />
                  <Form.Control
                    autoComplete="one-time-code"
                    disabled={isSubmitting}
                    inputMode="numeric"
                    name="mfa_code"
                    onChange={handleChange}
                    placeholder={loginRequiresMfaCode ? "Required" : "Only if Robinhood asks"}
                    type="text"
                    value={formValues.mfa_code}
                  />
                </div>
              </Form.Group>

              <Button className="login-submit" disabled={isSubmitting} type="submit">
                {isSubmitting && (
                  <Spinner
                    animation="border"
                    aria-hidden="true"
                    className="login-spinner"
                    size="sm"
                  />
                )}
                {showPendingMfaHint
                  ? "Waiting for approval..."
                  : isSubmitting
                  ? "Signing in..."
                  : "Sign In"}
              </Button>
            </Form>

            <p className="login-verification-note">
              You may be asked for a verification code.
            </p>
            <p className="login-security-note">
              <ShieldCheck size={18} aria-hidden="true" />
              Your credentials are encrypted in transit and never displayed.
            </p>
          </Card.Body>
        </Card>
      </section>
    </main>
  );
};

export default LoginPage;
