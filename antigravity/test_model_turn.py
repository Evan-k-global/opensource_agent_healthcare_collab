import unittest,time
from unittest.mock import patch
from run import execute_turn
class Response:
    async def text(self):return 'model summary'
class Agent:
    def __init__(self):self.prompts=[]
    async def chat(self,prompt):self.prompts.append(prompt);return Response()
class ModelTurnTests(unittest.IsolatedAsyncioTestCase):
    def status(self,**kw):return dict(caseId='case',step=8,nextAction='Prove joint result',state='computing',busy=False,canAct=True,**kw)
    async def test_one_correction_without_scripted_tool_call(self):
        agent=Agent();initial=self.status();done={**initial,'step':9}
        with patch('run.wait_status',side_effect=[initial,done]):self.assertEqual(await execute_turn(agent,'b-researcher',initial,{},time.monotonic()+1,0),1)
        self.assertEqual(len(agent.prompts),2);self.assertIn('one corrective attempt',agent.prompts[1])
    async def test_inflight_turn_waits_without_reprompt(self):
        agent=Agent();initial=self.status()
        with patch('run.wait_status',side_effect=[{**initial,'busy':True},{**initial,'step':9}]):self.assertEqual(await execute_turn(agent,'b-researcher',initial,{},time.monotonic()+1,0),0)
        self.assertEqual(len(agent.prompts),1)
    async def test_failure_and_case_change_do_not_reprompt(self):
        for change in [{'state':'failed'},{'caseId':'other'}]:
            agent=Agent();initial=self.status()
            with patch('run.wait_status',return_value={**initial,**change}):
                with self.assertRaises(RuntimeError):await execute_turn(agent,'b-researcher',initial,{},time.monotonic()+1,0)
            self.assertEqual(len(agent.prompts),1)
    async def test_no_action_is_bounded(self):
        agent=Agent();initial=self.status()
        with patch('run.wait_status',return_value=initial):
            with self.assertRaisesRegex(RuntimeError,'no scripted fallback'):await execute_turn(agent,'b-researcher',initial,{},time.monotonic()+1,0)
        self.assertEqual(len(agent.prompts),2)
