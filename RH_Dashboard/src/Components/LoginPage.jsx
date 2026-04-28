import { useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";

const LoginPage = ({ error, onLogin }) => {
  const [formValues, setFormValues] = useState({
    username: "",
    password: "",
    mfa_code: "",
  });
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setFormError(loginError.message);
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

          {(formError || error) && (
            <Alert className="login-alert" variant="danger">
              {formError || error}
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
                placeholder="Optional"
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
              {isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </main>
  );
};

export default LoginPage;
