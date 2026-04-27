from pathlib import Path
import os

import robin_stocks.robinhood as robin
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"
TOKEN_DIR = PROJECT_ROOT / ".tokens"


def login_to_robinhood():
    load_dotenv(ENV_PATH)

    username = os.getenv("RH_USERNAME")
    password = os.getenv("RH_PASSWORD")

    if not username or not password:
        raise RuntimeError(
            "Missing Robinhood credentials. Add RH_USERNAME and RH_PASSWORD to the project .env file."
        )

    TOKEN_DIR.mkdir(exist_ok=True)

    login = robin.login(
        username=username,
        password=password,
        pickle_path=str(TOKEN_DIR),
    )

    print("login successful")
    return login
