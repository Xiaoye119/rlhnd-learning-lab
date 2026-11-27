"""Protocol fixture only: this suite does not load weights or run inference."""
import importlib.util
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import unittest
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location("demo", Path(__file__).resolve().parents[1] / "serve_demo.py")
demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(demo)

class Fixture(BaseHTTPRequestHandler):
    received = None
    def log_message(self, *args):
        pass
    def do_GET(self):
        result = {"status":"ok"} if self.path == "/healthz" else {"model":"GoalWAM","horizon":48,"output_action_dim":49}
        self.send_response(200); self.end_headers(); self.wfile.write(json.dumps(result).encode())
    def do_POST(self):
        Fixture.received = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if Fixture.received.get("force_error"):
            self.send_response(422); self.end_headers(); self.wfile.write(b'{"error":"fixture input rejected"}'); return
        self.send_response(200); self.end_headers()
        self.wfile.write(json.dumps({"normalized_actions":[[[0]*49 for _ in range(48)]],"prefix_length":0,"test_fixture":True}).encode())

class ProxyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.upstream = ThreadingHTTPServer(("127.0.0.1",0),Fixture)
        cls.bridge = demo.make_server(0,"http://127.0.0.1:"+str(cls.upstream.server_port))
        for server in [cls.upstream,cls.bridge]:
            threading.Thread(target=server.serve_forever,daemon=True).start()
        cls.url = "http://127.0.0.1:"+str(cls.bridge.server_port)
    @classmethod
    def tearDownClass(cls):
        for server in [cls.bridge,cls.upstream]:
            server.shutdown();server.server_close()
    def get(self,path,body=None):
        req=urllib.request.Request(self.url+path,data=None if body is None else json.dumps(body).encode(),headers={"Content-Type":"application/json"})
        return urllib.request.urlopen(req,timeout=3)
    def test_metadata(self):
        with self.get("/api/metadata") as r: self.assertEqual(json.load(r)["horizon"],48)
    def test_forward_images_and_shapes(self):
        sample={"images":{"head":"aGVsbG8="},"normalized_state":[0]*49}
        with self.get("/api/infer",sample) as r: data=json.load(r)
        self.assertEqual(Fixture.received,sample)
        self.assertEqual(len(data["normalized_actions"][0]),48)
        self.assertEqual(len(data["normalized_actions"][0][0]),49)
        self.assertTrue(data["test_fixture"])
    def test_upstream_error_preserved(self):
        with self.assertRaises(urllib.error.HTTPError) as error: self.get("/api/infer",{"force_error":True})
        self.assertEqual(error.exception.code,422)
        error.exception.close()
    def test_unconfigured_is_explicit(self):
        original=self.bridge.upstream
        self.bridge.upstream=""
        try:
            with self.assertRaises(urllib.error.HTTPError) as error: self.get("/api/healthz")
            self.assertEqual(error.exception.code,503)
            error.exception.close()
        finally: self.bridge.upstream=original
    def test_no_arbitrary_files_or_proxy_endpoints(self):
        for path in ["/report.md","/sources/upstream/server.py","/api/other"]:
            with self.assertRaises(urllib.error.HTTPError) as error: self.get(path)
            self.assertEqual(error.exception.code,404)
            error.exception.close()

if __name__=="__main__":
    unittest.main()
