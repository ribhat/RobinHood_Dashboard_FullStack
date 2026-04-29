from contextlib import contextmanager
import builtins
import getpass
import logging
import time
import uuid

try:
    import robin_stocks.robinhood as robin
    import robin_stocks.robinhood.authentication as robin_auth
except ModuleNotFoundError:
    robin = None
    robin_auth = None


DEVICE_APPROVAL_TIMEOUT_SECONDS = 90
DEVICE_APPROVAL_POLL_INTERVAL_SECONDS = 3
PATHFINDER_USER_MACHINE_URL = "https://api.robinhood.com/pathfinder/user_machine/"
PATHFINDER_INQUIRY_URL_TEMPLATE = (
    "https://api.robinhood.com/pathfinder/inquiries/{inquiry_id}/user_view/"
)

logger = logging.getLogger(__name__)


class RobinhoodAuthError(Exception):
    pass


class RobinhoodVerificationRequired(RobinhoodAuthError):
    pass


def login_to_robinhood(username, password, mfa_code=None, on_verification_required=None):
    if robin is None or robin_auth is None:
        raise RobinhoodAuthError(
            "Robinhood support is not installed. Install project dependencies and try again."
        )

    username_text = str(username or "").strip()
    password_text = str(password or "")
    mfa_text = str(mfa_code or "").strip() or None

    if not username_text or not password_text:
        raise RobinhoodAuthError("Robinhood username and password are required.")

    try:
        login_response = login_with_device_approval(
            username_text,
            password_text,
            mfa_text,
            on_verification_required,
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


def login_with_device_approval(
    username,
    password,
    mfa_code=None,
    on_verification_required=None,
):
    device_token = robin_auth.generate_device_token()
    payload = build_login_payload(username, password, device_token, mfa_code)
    login_url = robin_auth.login_url()
    data = robin_auth.request_post(login_url, payload)

    return complete_login_response(
        data,
        payload,
        login_url,
        device_token,
        mfa_code,
        on_verification_required,
    )


def build_login_payload(username, password, device_token, mfa_code=None):
    payload = {
        "client_id": "c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS",
        "expires_in": 86400,
        "grant_type": "password",
        "password": password,
        "scope": "internal",
        "username": username,
        "challenge_type": "sms",
        "device_token": device_token,
        "try_passkeys": False,
        "token_request_path": "/login",
        "create_read_only_secondary_token": True,
        "request_id": str(uuid.uuid4()),
    }

    if mfa_code:
        payload["mfa_code"] = mfa_code

    return payload


def complete_login_response(
    data,
    payload,
    login_url,
    device_token,
    mfa_code=None,
    on_verification_required=None,
):
    notified_verification = False
    verification_inquiry_url = None
    deadline = time.monotonic() + DEVICE_APPROVAL_TIMEOUT_SECONDS

    while True:
        log_robinhood_auth_state("login_response", data)

        if not data:
            raise RobinhoodAuthError(
                "Unable to reach Robinhood. Check your connection and try again."
            )

        if data.get("access_token"):
            return finalize_login_response(data)

        if data.get("mfa_required"):
            notify_verification_required(on_verification_required)
            raise RobinhoodVerificationRequired(
                "Robinhood requires an MFA code. Enter the code and submit again."
            )

        if data.get("challenge"):
            notify_verification_required(on_verification_required)
            if not mfa_code:
                raise RobinhoodVerificationRequired(
                    "Robinhood sent a verification code. Enter it and submit again."
                )

            data = complete_challenge(data["challenge"]["id"], payload, login_url, mfa_code)
            continue

        verification_workflow = data.get("verification_workflow")
        if verification_workflow:
            if mfa_code:
                robin_auth._validate_sherrif_id(
                    device_token=device_token,
                    workflow_id=verification_workflow["id"],
                    mfa_code=mfa_code,
                )
                data = robin_auth.request_post(login_url, payload)
                continue

            if not notified_verification:
                notify_verification_required(on_verification_required)
                notified_verification = True

            if verification_inquiry_url is None:
                verification_inquiry_url = start_device_verification_inquiry(
                    device_token,
                    verification_workflow["id"],
                )

            if verification_inquiry_url:
                workflow_status = poll_device_verification_inquiry(
                    verification_inquiry_url,
                )

                if workflow_status == "approved":
                    logger.info("Robinhood device approval accepted; retrying token request.")
                    data = robin_auth.request_post(login_url, payload)
                    continue

                if workflow_status == "denied":
                    raise RobinhoodAuthError(
                        "Robinhood device approval was denied."
                    )

            if time.monotonic() >= deadline:
                raise RobinhoodVerificationRequired(
                    "Robinhood verification is still pending. Approve the prompt and try again."
                )

            time.sleep(DEVICE_APPROVAL_POLL_INTERVAL_SECONDS)
            data = robin_auth.request_post(login_url, payload)
            continue

        detail = (
            data.get("detail")
            or data.get("error_description")
            or data.get("error")
            or f"Received an error response {data}"
        )
        raise RobinhoodAuthError(normalize_login_error(detail))


def start_device_verification_inquiry(device_token, workflow_id):
    inquiry_response = robin_auth.request_post(
        url=PATHFINDER_USER_MACHINE_URL,
        payload={
            "device_id": device_token,
            "flow": "suv",
            "input": {
                "workflow_id": workflow_id,
            },
        },
        json=True,
    )
    log_robinhood_auth_state("device_inquiry_start", inquiry_response)
    inquiry_id = (inquiry_response or {}).get("id")

    if not inquiry_id:
        return None

    return PATHFINDER_INQUIRY_URL_TEMPLATE.format(inquiry_id=inquiry_id)


def poll_device_verification_inquiry(inquiry_url):
    inquiry_response = robin_auth.request_get(inquiry_url)
    log_robinhood_auth_state("device_inquiry_poll", inquiry_response)
    type_context = (inquiry_response or {}).get("type_context", {})
    result = type_context.get("result")

    if result == "workflow_status_approved":
        return "approved"

    if result == "workflow_status_denied":
        return "denied"

    return "pending"


def log_robinhood_auth_state(stage, data):
    if not isinstance(data, dict):
        logger.info(
            "Robinhood auth state: stage=%s response_type=%s",
            stage,
            type(data).__name__,
        )
        return

    verification_workflow = data.get("verification_workflow") or {}
    challenge = data.get("challenge") or {}
    type_context = data.get("type_context") or {}

    logger.info(
        "Robinhood auth state: stage=%s keys=%s workflow_status=%s "
        "challenge_status=%s inquiry_result=%s detail_present=%s error_present=%s",
        stage,
        sorted(data.keys()),
        verification_workflow.get("workflow_status"),
        challenge.get("status"),
        type_context.get("result"),
        bool(data.get("detail")),
        bool(data.get("error") or data.get("error_description")),
    )


def complete_challenge(challenge_id, payload, login_url, mfa_code):
    challenge_response = robin_auth.respond_to_challenge(challenge_id, mfa_code)

    if "challenge" in challenge_response:
        remaining_attempts = challenge_response["challenge"].get("remaining_attempts", 0)
        raise RobinhoodVerificationRequired(
            f"That verification code was not accepted. {remaining_attempts} attempt(s) remaining."
        )

    robin_auth.update_session("X-ROBINHOOD-CHALLENGE-RESPONSE-ID", challenge_id)
    return robin_auth.request_post(login_url, payload)


def finalize_login_response(data):
    token = f"{data['token_type']} {data['access_token']}"
    robin_auth.update_session("Authorization", token)
    robin_auth.set_login_state(True)
    data["detail"] = "logged in with brand new authentication code."
    return data


def logout_from_robinhood():
    if robin is None:
        return

    try:
        robin.logout()
    except Exception:
        pass


@contextmanager
def block_interactive_prompts(on_verification_required=None):
    original_input = builtins.input
    original_print = builtins.print
    original_getpass = getpass.getpass

    def raise_prompt_error(*_args, **_kwargs):
        notify_verification_required(on_verification_required)
        raise RobinhoodVerificationRequired(verification_required_message())

    def capture_verification_print(*args, **kwargs):
        message = " ".join(str(arg) for arg in args)
        if looks_like_verification_required(message):
            notify_verification_required(on_verification_required)
        original_print(*args, **kwargs)

    builtins.input = raise_prompt_error
    builtins.print = capture_verification_print
    getpass.getpass = raise_prompt_error

    try:
        yield
    finally:
        builtins.input = original_input
        builtins.print = original_print
        getpass.getpass = original_getpass


def notify_verification_required(callback):
    if callback is None:
        return

    callback()


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
