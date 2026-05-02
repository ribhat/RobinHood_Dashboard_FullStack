import argparse
from collections import deque
from dataclasses import dataclass
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
from typing import Iterable
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser


ROOT = Path(__file__).resolve().parent
BACKEND_HEALTH_URL = "http://127.0.0.1:5000/api/health"
DEFAULT_FRONTEND_URL = "http://localhost:5173/"
ANSI_ESCAPE_PATTERN = re.compile(r"\x1b\[[0-9;]*m")


@dataclass(frozen=True)
class RequiredPort:
    label: str
    host: str
    port: int


REQUIRED_PORTS = (
    RequiredPort("Flask backend", "127.0.0.1", 5000),
    RequiredPort("Vite frontend", "127.0.0.1", 5173),
)


@dataclass
class PrerequisiteResult:
    ok: bool
    messages: list[str]
    backend_python: str
    npm_command: str | None


def choose_backend_python(root: Path) -> str:
    venv_python = root / ".venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        return str(venv_python)

    return sys.executable


def resolve_npm_command(npm_command: str | None = None) -> str | None:
    return shutil.which(npm_command or "npm")


def is_port_in_use(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.25):
            return True
    except OSError:
        return False


def find_port_conflicts(ports: Iterable[RequiredPort] = REQUIRED_PORTS) -> list[str]:
    messages = []
    for required_port in ports:
        if is_port_in_use(required_port.host, required_port.port):
            messages.append(
                f"{required_port.label} port {required_port.port} is already in use on "
                f"{required_port.host}. Stop the process using it, then rerun "
                "`python .\\launch_dashboard.py`. On Windows, check it with "
                f"`Get-NetTCPConnection -LocalPort {required_port.port} | "
                "Select-Object LocalAddress,LocalPort,State,OwningProcess`."
            )

    return messages


def check_prerequisites(
    root: Path,
    npm_command: str | None = None,
    python_executable: str | None = None,
) -> PrerequisiteResult:
    backend_python = python_executable or choose_backend_python(root)
    resolved_npm = resolve_npm_command(npm_command)
    messages: list[str] = []

    if not (root / "Server" / "main.py").exists():
        messages.append("Missing Server\\main.py. Run this launcher from the project root.")

    frontend_dir = root / "RH_Dashboard"
    if not (frontend_dir / "package.json").exists():
        messages.append("Missing RH_Dashboard\\package.json. Run this launcher from the project root.")

    if resolved_npm is None:
        messages.append(
            "npm was not found on PATH. Install Node.js, then run `npm install` in RH_Dashboard."
        )

    if not (frontend_dir / "node_modules").exists():
        messages.append(
            "Frontend dependencies are missing. Run `npm install` from RH_Dashboard."
        )

    messages.extend(find_port_conflicts())

    if not messages:
        dependency_check = subprocess.run(
            [
                backend_python,
                "-c",
                "import flask, flask_cors, requests",
            ],
            cwd=root / "Server",
            capture_output=True,
            text=True,
            timeout=10,
        )
        if dependency_check.returncode != 0:
            messages.append(
                "Backend Python dependencies are missing. Run `pip install -r requirements.txt` "
                "or recreate .venv, then try again."
            )

    return PrerequisiteResult(
        ok=not messages,
        messages=messages,
        backend_python=backend_python,
        npm_command=resolved_npm,
    )


def wait_for_http(url: str, timeout_seconds: float, label: str, quiet: bool = False) -> bool:
    deadline = time.monotonic() + timeout_seconds
    last_error = ""

    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=1) as response:
                if 200 <= response.status < 400:
                    return True
        except URLError as error:
            last_error = str(error.reason)
        except OSError as error:
            last_error = str(error)

        time.sleep(0.25)

    if quiet:
        return False

    if last_error:
        print(f"{label} did not become ready at {url}: {last_error}", file=sys.stderr)
    else:
        print(f"{label} did not become ready at {url}.", file=sys.stderr)
    return False


def extract_vite_url(output: str) -> str | None:
    plain_output = ANSI_ESCAPE_PATTERN.sub("", output)
    match = re.search(r"Local:\s+(https?://[^\s]+)", plain_output)
    if match:
        return match.group(1)

    return None


def print_process_output(name: str, process: subprocess.Popen, lines: deque[str]) -> None:
    assert process.stdout is not None
    for line in process.stdout:
        clean_line = line.rstrip()
        lines.append(clean_line)
        print(f"[{name}] {clean_line}")


def start_process(
    name: str,
    command: Iterable[str],
    cwd: Path,
) -> tuple[subprocess.Popen, deque[str], threading.Thread]:
    lines: deque[str] = deque(maxlen=80)
    process = subprocess.Popen(
        list(command),
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    thread = threading.Thread(
        target=print_process_output,
        args=(name, process, lines),
        daemon=True,
    )
    thread.start()
    return process, lines, thread


def stop_process(process: subprocess.Popen, name: str) -> None:
    if process.poll() is not None:
        return

    print(f"Stopping {name}...")
    if os.name == "nt":
        taskkill = subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if taskkill.returncode == 0 or process.poll() is not None:
            return

    process.terminate()
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def fail_if_exited(process: subprocess.Popen, name: str, lines: deque[str]) -> bool:
    if process.poll() is None:
        return False

    print(f"{name} exited before the dashboard was ready.", file=sys.stderr)
    if lines:
        print(f"Last {name} output:", file=sys.stderr)
        for line in list(lines)[-12:]:
            print(f"  {line}", file=sys.stderr)
    return True


def launch(open_browser: bool = True) -> int:
    prerequisites = check_prerequisites(ROOT)
    if not prerequisites.ok:
        print("Cannot start the dashboard yet:", file=sys.stderr)
        for message in prerequisites.messages:
            print(f"- {message}", file=sys.stderr)
        return 1

    backend = frontend = None
    try:
        print("Starting Flask backend on http://127.0.0.1:5000 ...")
        backend, backend_lines, _ = start_process(
            "backend",
            [prerequisites.backend_python, "main.py"],
            ROOT / "Server",
        )

        if not wait_for_http(BACKEND_HEALTH_URL, timeout_seconds=25, label="Backend"):
            fail_if_exited(backend, "Backend", backend_lines)
            return 1
        if fail_if_exited(backend, "Backend", backend_lines):
            return 1

        print("Starting Vite frontend on http://localhost:5173 ...")
        frontend, frontend_lines, _ = start_process(
            "frontend",
            [
                prerequisites.npm_command,
                "run",
                "dev",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                "5173",
                "--strictPort",
            ],
            ROOT / "RH_Dashboard",
        )

        frontend_url = DEFAULT_FRONTEND_URL
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if fail_if_exited(frontend, "Frontend", frontend_lines):
                return 1

            parsed_url = extract_vite_url("\n".join(frontend_lines))
            if parsed_url:
                frontend_url = parsed_url

            if wait_for_http(frontend_url, timeout_seconds=1, label="Frontend", quiet=True):
                break
        else:
            print(f"Frontend did not become ready at {frontend_url}.", file=sys.stderr)
            return 1

        print(f"Dashboard is ready: {frontend_url}")
        if open_browser:
            webbrowser.open(frontend_url)

        print("Leave this window open while using the dashboard. Press Ctrl+C to stop.")
        while True:
            if fail_if_exited(backend, "Backend", backend_lines):
                return 1
            if fail_if_exited(frontend, "Frontend", frontend_lines):
                return 1
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down dashboard...")
        return 0
    finally:
        if frontend is not None:
            stop_process(frontend, "frontend")
        if backend is not None:
            stop_process(backend, "backend")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start the local RobinHood dashboard.")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Start the app without opening a browser window.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return launch(open_browser=not args.no_browser)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal.default_int_handler)
    raise SystemExit(main())
