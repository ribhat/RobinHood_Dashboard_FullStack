import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";

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
    <main className="login-page">
      <Card className="login-card">
        <Card.Body>
          <div className="login-header">
            <span className="metric-kicker">Robinhood Session</span>
            <h1>Dividend Dashboard</h1>
            <p>Log in locally to load your portfolio and dividend data.</p>
          </div>

          {loginMessage && (
            <Alert className="login-alert" variant={loginMessageVariant}>
              {loginMessage}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="robinhood-username">
              <Form.Label>Username</Form.Label>
              <Form.Control
                autoComplete="username"
                disabled={isSubmitting}
                name="username"
                onChange={handleChange}
                type="text"
                value={formValues.username}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="robinhood-password">
              <Form.Label>Password</Form.Label>
              <Form.Control
                autoComplete="current-password"
                disabled={isSubmitting}
                name="password"
                onChange={handleChange}
                type="password"
                value={formValues.password}
              />
            </Form.Group>

            <Form.Group className="mb-4" controlId="robinhood-mfa">
              <Form.Label>MFA code</Form.Label>
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
              {showPendingMfaHint ? "Waiting for approval..." : isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </main>
  );
};

export default LoginPage;
