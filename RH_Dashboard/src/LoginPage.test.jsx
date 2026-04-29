import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./Components/LoginPage";

describe("LoginPage", () => {
  it("submits local Robinhood credentials through the login handler", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue();

    render(<LoginPage onLogin={onLogin} />);

    await user.type(screen.getByLabelText(/username/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(onLogin).toHaveBeenCalledWith({
      username: "user@example.com",
      password: "secret-password",
      mfa_code: undefined,
    });
  });

  it("shows the MFA guidance when Robinhood requests verification", async () => {
    const user = userEvent.setup();
    const verificationError = new Error("MFA required");
    verificationError.mfaRequired = true;
    const onLogin = vi.fn().mockRejectedValue(verificationError);

    render(<LoginPage onLogin={onLogin} />);

    await user.type(screen.getByLabelText(/username/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(
      await screen.findByText(/Robinhood needs phone approval/i)
    ).toBeInTheDocument();
  });

  it("asks for the MFA code when Robinhood requires a challenge response", async () => {
    const user = userEvent.setup();
    const verificationError = new Error("MFA code required");
    verificationError.mfaRequired = true;
    verificationError.mfaCodeRequired = true;
    verificationError.code = "mfa_code_required";
    const onLogin = vi.fn().mockRejectedValue(verificationError);

    render(<LoginPage onLogin={onLogin} />);

    await user.type(screen.getByLabelText(/username/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(
      await screen.findByText(/Robinhood requires an MFA code/i)
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Required")).toBeInTheDocument();
  });
});
