"""Temporary browser QA upstream, explicitly synthetic. Not a model server."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import base64
import json
from pathlib import Path
import sys
import threading
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from serve_demo import make_server

class ContractFixture(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        data = {"status":"ok"} if self.path == "/healthz" else {"model":"GoalWAM","horizon":48,"output_action_dim":49,"test_fixture":True,"physical_inputs":True}
        self.send_response(200);self.end_headers();self.wfile.write(json.dumps(data).encode())
    def do_POST(self):
        observation=json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        for key in ["images","goal_images"]:
            assert not observation[key]["head"].startswith("data:")
            assert base64.b64decode(observation[key]["head"],validate=True).startswith(b"\x89PNG")
        result={"normalized_actions":[[[0.01*k if j in [26,34] else 0 for j in range(49)] for k in range(48)]],"prefix_length":0,"test_fixture":True}
        self.send_response(200);self.end_headers();self.wfile.write(json.dumps(result).encode())

if __name__=="__main__":
    fixture=ThreadingHTTPServer(("127.0.0.1",0),ContractFixture)
    threading.Thread(target=fixture.serve_forever,daemon=True).start()
    bridge=make_server(18766,"http://127.0.0.1:"+str(fixture.server_port))
    print("QA ONLY: http://127.0.0.1:18766; responses are synthetic protocol fixtures",flush=True)
    try: bridge.serve_forever()
    except KeyboardInterrupt: pass
    finally: bridge.server_close();fixture.shutdown();fixture.server_close()
