"""Deterministic OpenAI-compatible fixture. Not Gemma or intelligence validation."""
import argparse, json, re, time, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
stats = {"chatRequests": 0, "adviceRequests": 0, "toolCalls": 0}
lock = threading.Lock()
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps({"fixture": True, **stats}).encode())
    def do_POST(self):
        size = int(self.headers.get('Content-Length', '0'))
        if size > 2_000_000: self.send_error(413); return
        body = json.loads(self.rfile.read(size))
        with lock: stats['chatRequests'] += 1
        messages = body.get('messages', [])
        system = ' '.join(str(m.get('content','')) for m in messages if m['role']=='system')
        if 'workflow adviser' in system:
            request = json.loads(messages[-1]['content'])
            with lock: stats['adviceRequests'] += 1
            msg = {'role':'assistant', 'content': json.dumps({'decision':'proceed','role':request['role'],'rationale':'Mock advice: retain the fixed circuit, private inputs and aggregate-only disclosure.'})}
            name = None
        else:
            last = max((i for i,m in enumerate(messages) if m['role']=='user'), default=0)
            recent = messages[last:]; text = json.dumps(recent)
            step = re.findall(r'expectedStep=(\d+)', text)
            tools = [t['function']['name'] for t in body.get('tools', [])]
            called = [json.loads(c['function']['arguments']).get('ToolName', c['function']['name']) for m in recent for c in m.get('tool_calls', [])]
            action = next((a for a in ['research_status','research_take_turn'] if not any(n.endswith(a) for n in called)), None)
            name = next((n for n in tools if action and n.endswith(action)), None)
            if action and 'call_mcp_tool' in tools: name = 'call_mcp_tool'
            msg = {'role':'assistant','content':'Synthetic step completed through its scoped tool.'}
            if name:
                args = {'expectedStep':int(step[-1])} if action=='research_take_turn' and step else {}
                if name=='call_mcp_tool':
                    agent = re.search(r'You are ([ab]-(?:researcher|liaison|reviewer))', text).group(1)
                    args = {'ServerName':'research-'+agent,'ToolName':action,'Arguments':args,'toolSummary':'Synthetic step','toolAction':'Testing scoped tools'}
                msg = {'role':'assistant','content':None,'tool_calls':[{'id':'call_'+str(time.time_ns()),'type':'function','function':{'name':name,'arguments':json.dumps(args)}}]}
                with lock: stats['toolCalls'] += 1
        finish = 'tool_calls' if name else 'stop'
        obj = {'id':'fixture','object':'chat.completion','created':int(time.time()),'model':'transport-fixture','choices':[{'index':0,'message':msg,'finish_reason':finish}],'usage':{'prompt_tokens':10,'completion_tokens':10,'total_tokens':20}}
        self.send_response(200)
        if body.get('stream'):
            self.send_header('Content-Type','text/event-stream'); self.end_headers()
            delta = dict(msg)
            if name: delta['tool_calls'][0]['index']=0
            chunk = {**obj,'object':'chat.completion.chunk','choices':[{'index':0,'delta':delta,'finish_reason':None}]}
            end = {**chunk,'choices':[{'index':0,'delta':{},'finish_reason':finish}]}
            self.wfile.write(('data: '+json.dumps(chunk)+'\n\ndata: '+json.dumps(end)+'\n\ndata: [DONE]\n\n').encode())
        else:
            self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(json.dumps(obj).encode())
if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=17411)
    ThreadingHTTPServer(('127.0.0.1',parser.parse_args().port),Handler).serve_forever()
