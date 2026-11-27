"""Local static demo and same-origin proxy for the official GoalWAM server.
No model runs in this process. Python 3.10+, standard library only.
"""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
MAX_BODY = 32 * 1024 * 1024

class LocalServer(ThreadingHTTPServer):
    # Avoid sharing a busy localhost port with an unrelated server on Windows.
    allow_reuse_address = False

class DemoHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Never log request bodies, image contents or state.
        super().log_message(fmt, *args)

    def reply(self, status, body, mime="application/json; charset=utf-8"):
        if isinstance(body, dict):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path in ("/", "/index.html"):
            return self.reply(200, (ROOT / "index.html").read_bytes(), "text/html; charset=utf-8")
        if path in ("/api/healthz", "/api/metadata"):
            return self.proxy(path.removeprefix("/api"), None)
        self.reply(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/api/infer":
            return self.reply(404, {"error": "Not found"})
        origin = self.headers.get("Origin")
        if origin and origin != "http://" + self.headers.get("Host", ""):
            return self.reply(403, {"error": "Only same-origin requests are accepted"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.reply(400, {"error": "Invalid content length"})
        if length <= 0 or length > MAX_BODY:
            return self.reply(413, {"error": "Request must be between 1 byte and 32 MiB"})
        body = self.rfile.read(length)
        try:
            observation = json.loads(body)
            if not isinstance(observation, dict):
                raise ValueError("JSON object required")
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, {"error": "Request must be a JSON object"})
        self.proxy("/infer", body)

    def proxy(self, endpoint, body):
        upstream = self.server.upstream
        if not upstream:
            return self.reply(503, {"error": "未配置模型服务。请用 --upstream http://127.0.0.1:8000 启动桥接器。"})
        request = urllib.request.Request(upstream + endpoint, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=590 if body is not None else 12) as response:
                result = response.read(MAX_BODY + 1)
                if len(result) > MAX_BODY:
                    return self.reply(502, {"error": "Upstream response exceeds 32 MiB"})
                self.reply(response.status, result)
        except urllib.error.HTTPError as exc:
            result = exc.read(MAX_BODY)
            exc.close()
            try:
                parsed = json.loads(result)
            except (ValueError, UnicodeDecodeError):
                parsed = {"error": "Upstream HTTP " + str(exc.code)}
            self.reply(exc.code, parsed)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            self.reply(502, {"error": "模型服务无法访问：" + str(exc)})

def make_server(port=18765, upstream=""):
    if upstream:
        parsed = urllib.parse.urlsplit(upstream)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.query or parsed.fragment or parsed.username or parsed.password or parsed.path not in ("", "/"):
            raise ValueError("--upstream must be an HTTP(S) origin, without credentials, path or query")
    server = LocalServer(("127.0.0.1", port), DemoHandler)
    server.upstream = upstream.rstrip("/")
    return server

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=18765)
    parser.add_argument("--upstream", default="", help="Official GoalWAM HTTP server origin")
    args = parser.parse_args()
    server = make_server(args.port, args.upstream)
    print(f"Demo: http://127.0.0.1:{server.server_port}", flush=True)
    print("Model upstream: " + (server.upstream or "(not configured; teaching mode)"), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
