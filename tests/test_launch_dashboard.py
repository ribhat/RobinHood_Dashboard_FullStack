import socket
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

import launch_dashboard


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


def _free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class LauncherPrerequisiteTests(unittest.TestCase):
    def test_missing_backend_file_reports_install_location(self):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "RH_Dashboard" / "node_modules").mkdir(parents=True)
            (root / "RH_Dashboard" / "package.json").write_text("{}", encoding="utf-8")

            result = launch_dashboard.check_prerequisites(
                root,
                npm_command="npm",
                python_executable="python",
            )

        self.assertFalse(result.ok)
        self.assertIn("Server\\main.py", result.messages[0])

    @patch("launch_dashboard.shutil.which", return_value=None)
    def test_missing_npm_reports_frontend_install_command(self, _which):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "Server").mkdir()
            (root / "Server" / "main.py").write_text("print('ok')", encoding="utf-8")
            (root / "RH_Dashboard" / "node_modules").mkdir(parents=True)
            (root / "RH_Dashboard" / "package.json").write_text("{}", encoding="utf-8")

            result = launch_dashboard.check_prerequisites(root, python_executable="python")

        self.assertFalse(result.ok)
        self.assertIn("npm was not found", result.messages[0])
        self.assertIn("npm install", result.messages[0])

    def test_port_conflict_reports_port_and_process_lookup_hint(self):
        port = _free_port()
        blocker = socket.socket()
        blocker.bind(("127.0.0.1", port))
        blocker.listen(1)
        self.addCleanup(blocker.close)

        messages = launch_dashboard.find_port_conflicts(
            [launch_dashboard.RequiredPort("test service", "127.0.0.1", port)]
        )

        self.assertEqual(len(messages), 1)
        self.assertIn(str(port), messages[0])
        self.assertIn("test service", messages[0])
        self.assertIn("Get-NetTCPConnection", messages[0])


class LauncherReadinessTests(unittest.TestCase):
    def test_wait_for_http_accepts_ready_health_endpoint(self):
        port = _free_port()
        server = HTTPServer(("127.0.0.1", port), _HealthHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(lambda: (server.shutdown(), thread.join(2), server.server_close()))

        self.assertTrue(
            launch_dashboard.wait_for_http(
                f"http://127.0.0.1:{port}/api/health",
                timeout_seconds=2,
                label="backend",
            )
        )

    def test_extract_vite_url_prefers_local_host_url(self):
        output = """
          VITE v6.4.2  ready in 481 ms

          Local:   http://localhost:5173/
          Network: use --host to expose
        """

        self.assertEqual(
            launch_dashboard.extract_vite_url(output),
            "http://localhost:5173/",
        )

    def test_extract_vite_url_handles_vite_color_codes(self):
        output = "\x1b[32mLocal\x1b[39m:   \x1b[36mhttp://127.0.0.1:\x1b[1m5174\x1b[22m/\x1b[39m"

        self.assertEqual(
            launch_dashboard.extract_vite_url(output),
            "http://127.0.0.1:5174/",
        )


class LauncherProcessCleanupTests(unittest.TestCase):
    @patch("launch_dashboard.os.name", "nt")
    @patch("launch_dashboard.subprocess.run")
    def test_stop_process_uses_windows_process_tree_kill(self, run):
        process = Mock()
        process.pid = 1234
        process.poll.return_value = None
        run.return_value.returncode = 0

        launch_dashboard.stop_process(process, "frontend")

        run.assert_called_once_with(
            ["taskkill", "/PID", "1234", "/T", "/F"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        process.terminate.assert_not_called()


if __name__ == "__main__":
    unittest.main()
