from contextlib import contextmanager
import builtins
import getpass

try:
    import robin_stocks.robinhood as robin
except ModuleNotFoundError:
    robin = None


class RobinhoodAuthError(Exception):
    pass


class RobinhoodVerificationRequired(RobinhoodAuthError):
    pass


def login_to_robinhood(username, password, mfa_code=None):
    if robin is None:
        raise RobinhoodAuthError(
            "Robinhood support is not installed. Install project dependencies and try again."
        )

    username_text = str(username or "").strip()
    password_text = str(password or "")
    mfa_text = str(mfa_code or "").strip() or None

    if not username_text or not password_text:
        raise RobinhoodAuthError("Robinhood username and password are required.")

    try:
        with block_interactive_prompts():
            login_response = robin.login(
                username=username_text,
                password=password_text,
                mfa_code=mfa_text,
                store_session=False,
            )
    except RobinhoodVerificationRequired:
        raise
    except Exception as error:
        message = str(error) or "Unable to log in with those Robinhood credentials."
        if looks_like_verification_required(message):
            raise RobinhoodVerificationRequired(verification_required_message()) from error
        raise RobinhoodAuthError(normalize_login_error(message)) from error

    validate_login_response(login_response)
    return login_response


def logout_from_robinhood():
    if robin is None:
        return

    try:
        robin.logout()
    except Exception:
        pass


@contextmanager
def block_interactive_prompts():
    original_input = builtins.input
    original_getpass = getpass.getpass

    def raise_prompt_error(*_args, **_kwargs):
        raise RobinhoodVerificationRequired(verification_required_message())

    builtins.input = raise_prompt_error
    getpass.getpass = raise_prompt_error

    try:
        yield
    finally:
        builtins.input = original_input
        getpass.getpass = original_getpass


def validate_login_response(login_response):
    if not login_response:
        raise RobinhoodAuthError("Unable to log in with those Robinhood credentials.")

    if not isinstance(login_response, dict):
        return

    if login_response.get("access_token"):
        return

    detail = (
        login_response.get("detail")
        or login_response.get("error_description")
        or login_response.get("error")
        or ""
    )

    if login_response.get("mfa_required") or login_response.get("challenge"):
        raise RobinhoodVerificationRequired(verification_required_message())

    if looks_like_verification_required(detail):
        raise RobinhoodVerificationRequired(verification_required_message())

    raise RobinhoodAuthError(normalize_login_error(detail))


def looks_like_verification_required(message):
    message_text = str(message or "").lower()
    verification_terms = (
        "challenge",
        "mfa",
        "multi-factor",
        "multifactor",
        "verification",
        "two-factor",
        "2fa",
    )
    return any(term in message_text for term in verification_terms)


def verification_required_message():
    return (
        "Robinhood requires additional verification. Enter an MFA code and try again."
    )


def normalize_login_error(message):
    if not message:
        return "Unable to log in with those Robinhood credentials."

    if "invalid" in message.lower() or "credentials" in message.lower():
        return "Unable to log in with those Robinhood credentials."

    return message
