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
CHALLENGE_URL_TEMPLATE = "https://api.robinhood.com/challenge/{challenge_id}/"
PROMPT_CHALLENGE_SUCCESS_STATUSES = {"approved", "validated"}
PROMPT_CHALLENGE_FAILURE_STATUSES = {
    "canceled",
    "cancelled",
    "denied",
    "expired",
    "failed",
    "rejected",
}

logger = logging.getLogger(__name__)


class RobinhoodAuthError(Exception):
    pass


class RobinhoodVerificationRequired(RobinhoodAuthError):
    def __init__(
        self,
        message,
        pending_login=None,
        mfa_code_required=False,
    ):
        super().__init__(message)
        self.pending_login = pending_login
        self.mfa_code_required = mfa_code_required


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
                "Robinhood requires an MFA code. Enter the code and submit again.",
                mfa_code_required=True,
            )

        if data.get("challenge"):
            notify_verification_required(on_verification_required)
            if not mfa_code:
                raise RobinhoodVerificationRequired(
                    "Robinhood sent a verification code. Enter it and submit again.",
                    pending_login=build_pending_login_context(
                        payload,
                        login_url,
                        device_token,
                        challenge_id=data["challenge"]["id"],
                    ),
                    mfa_code_required=True,
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
                workflow_state = poll_device_verification_inquiry(
                    verification_inquiry_url,
                )
                workflow_status = workflow_state["status"]

                if workflow_status == "challenge":
                    sheriff_challenge = workflow_state.get("sheriff_challenge") or {}
                    challenge_type = str(sheriff_challenge.get("type") or "").lower()
                    challenge_id = sheriff_challenge.get("id")

                    if challenge_type == "prompt" and challenge_id:
                        prompt_status = wait_for_prompt_challenge(
                            challenge_id,
                            deadline,
                        )

                        if prompt_status in PROMPT_CHALLENGE_SUCCESS_STATUSES:
                            workflow_state = continue_device_verification_inquiry(
                                verification_inquiry_url,
                                workflow_state.get("sequence"),
                            )
                            workflow_status = workflow_state["status"]

                            if workflow_status == "approved":
                                logger.info(
                                    "Robinhood device approval accepted; "
                                    "retrying token request."
                                )
                                data = robin_auth.request_post(login_url, payload)
                                continue

                            if workflow_status == "denied":
                                raise RobinhoodAuthError(
                                    "Robinhood device approval was denied."
                                )

                        elif prompt_status in PROMPT_CHALLENGE_FAILURE_STATUSES:
                            raise RobinhoodAuthError(
                                "Robinhood device approval was denied or expired."
                            )

                        if time.monotonic() >= deadline:
                            raise RobinhoodVerificationRequired(
                                "Robinhood verification is still pending. "
                                "Approve the prompt and try again."
                            )

                        time.sleep(DEVICE_APPROVAL_POLL_INTERVAL_SECONDS)
                        continue

                    raise RobinhoodVerificationRequired(
                        "Robinhood requires an MFA code. Enter the code and submit again.",
                        pending_login=build_pending_login_context(
                            payload,
                            login_url,
                            device_token,
                            verification_workflow["id"],
                        ),
                        mfa_code_required=True,
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
                continue

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


def build_pending_login_context(
    payload,
    login_url,
    device_token,
    workflow_id=None,
    challenge_id=None,
):
    return {
        "payload": dict(payload),
        "login_url": login_url,
        "device_token": device_token,
        "workflow_id": workflow_id,
        "challenge_id": challenge_id,
        "created_at": time.monotonic(),
    }


def complete_pending_login(pending_login, mfa_code):
    mfa_text = str(mfa_code or "").strip()

    if not pending_login:
        raise RobinhoodVerificationRequired(
            "Robinhood requires a fresh login attempt before submitting an MFA code.",
            mfa_code_required=True,
        )

    if not mfa_text:
        raise RobinhoodVerificationRequired(
            "Robinhood requires an MFA code. Enter the code and submit again.",
            pending_login=pending_login,
            mfa_code_required=True,
        )

    workflow_id = pending_login.get("workflow_id")
    challenge_id = pending_login.get("challenge_id")

    if challenge_id:
        data = complete_challenge(
            challenge_id,
            pending_login["payload"],
            pending_login["login_url"],
            mfa_text,
        )
        return complete_login_response(
            data,
            pending_login["payload"],
            pending_login["login_url"],
            pending_login["device_token"],
            mfa_text,
        )

    if workflow_id:
        robin_auth._validate_sherrif_id(
            device_token=pending_login["device_token"],
            workflow_id=workflow_id,
            mfa_code=mfa_text,
        )
        data = robin_auth.request_post(
            pending_login["login_url"],
            pending_login["payload"],
        )
        return complete_login_response(
            data,
            pending_login["payload"],
            pending_login["login_url"],
            pending_login["device_token"],
            mfa_text,
        )

    pending_login["payload"]["mfa_code"] = mfa_text
    data = robin_auth.request_post(
        pending_login["login_url"],
        pending_login["payload"],
    )
    return complete_login_response(
        data,
        pending_login["payload"],
        pending_login["login_url"],
        pending_login["device_token"],
        mfa_text,
    )


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
    return describe_device_verification_response(inquiry_response)


def continue_device_verification_inquiry(inquiry_url, sequence):
    inquiry_response = robin_auth.request_post(
        url=inquiry_url,
        payload={
            "sequence": sequence or 0,
            "user_input": {
                "status": "continue",
            },
        },
        json=True,
    )
    log_robinhood_auth_state("device_inquiry_continue", inquiry_response)
    return describe_device_verification_response(inquiry_response)


def describe_device_verification_response(inquiry_response):
    inquiry_response = inquiry_response or {}
    type_context = (inquiry_response or {}).get("type_context", {})
    result = type_context.get("result") or inquiry_response.get("result")
    sheriff_challenge = get_sheriff_challenge(inquiry_response)

    if result == "workflow_status_approved":
        return {
            "status": "approved",
            "sequence": inquiry_response.get("sequence"),
            "sheriff_challenge": sheriff_challenge,
        }

    if result == "workflow_status_denied":
        return {
            "status": "denied",
            "sequence": inquiry_response.get("sequence"),
            "sheriff_challenge": sheriff_challenge,
        }

    if (
        str(inquiry_response.get("state_name", "")).lower() == "challenge"
        or sheriff_challenge
    ):
        return {
            "status": "challenge",
            "sequence": inquiry_response.get("sequence"),
            "sheriff_challenge": sheriff_challenge,
        }

    return {
        "status": "pending",
        "sequence": inquiry_response.get("sequence"),
        "sheriff_challenge": sheriff_challenge,
    }


def get_sheriff_challenge(data):
    type_context = (data or {}).get("type_context") or {}
    context = type_context.get("context") or {}

    if not isinstance(context, dict):
        return {}

    sheriff_challenge = context.get("sheriff_challenge") or {}
    return sheriff_challenge if isinstance(sheriff_challenge, dict) else {}


def wait_for_prompt_challenge(challenge_id, deadline):
    while True:
        prompt_status = poll_prompt_challenge(challenge_id)

        if (
            prompt_status in PROMPT_CHALLENGE_SUCCESS_STATUSES
            or prompt_status in PROMPT_CHALLENGE_FAILURE_STATUSES
        ):
            return prompt_status

        if time.monotonic() >= deadline:
            return prompt_status or "pending"

        time.sleep(DEVICE_APPROVAL_POLL_INTERVAL_SECONDS)


def poll_prompt_challenge(challenge_id):
    challenge_response = robin_auth.request_get(
        CHALLENGE_URL_TEMPLATE.format(challenge_id=challenge_id)
    )
    log_robinhood_auth_state("prompt_challenge_poll", challenge_response)
    return str((challenge_response or {}).get("status") or "").lower()


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
    sheriff_challenge = get_sheriff_challenge(data)

    logger.info(
        "Robinhood auth state: stage=%s keys=%s workflow_status=%s "
        "challenge_status=%s challenge_type=%s inquiry_result=%s state_name=%s "
        "response_type=%s polling_interval=%s type_context_keys=%s "
        "detail_present=%s error_present=%s",
        stage,
        sorted(data.keys()),
        verification_workflow.get("workflow_status"),
        challenge.get("status") or data.get("status") or sheriff_challenge.get("status"),
        challenge.get("type") or data.get("type") or sheriff_challenge.get("type"),
        type_context.get("result"),
        data.get("state_name"),
        data.get("type"),
        data.get("polling_interval"),
        sorted(type_context.keys()) if isinstance(type_context, dict) else [],
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
