import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
import run as driver

class StatusRetryTests(unittest.IsolatedAsyncioTestCase):
    async def test_compilation_pause_retries_only_read_status(self):
        with patch.object(driver, 'read_status', side_effect=[TimeoutError('compiling'), {'step':10,'state':'settled'}]) as read:
            result=await driver.wait_status({'token':'test'},time.monotonic()+1,.01)
            self.assertEqual(result['state'],'settled')
            self.assertEqual(read.call_count,2)

    async def test_bad_credentials_are_fatal(self):
        with patch.object(driver, 'read_status', side_effect=HTTPError('http://localhost',401,'unauthorized',None,None)) as read:
            with self.assertRaises(HTTPError): await driver.wait_status({},time.monotonic()+1,.01)
            self.assertEqual(read.call_count,1)

    async def test_disconnected_peer_has_a_bounded_deadline(self):
        with patch.object(driver, 'read_status', side_effect=URLError('connection refused')):
            with self.assertRaisesRegex(TimeoutError,'deadline'): await driver.wait_status({},time.monotonic()+.03,.01)

if __name__=='__main__': unittest.main()
