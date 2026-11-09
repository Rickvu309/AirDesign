import json
from contextlib import closing
import os
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import health
import worktree_safety as safety

BUNDLE = Path(__file__).resolve().parents[2] / 'bench/design-parity/fixtures/history/base.bundle'

class CleanupTests(unittest.TestCase):
    def setUp(self):
        (Path.home() / 'tmp').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=Path.home() / 'tmp', prefix='repo-health-test-')
        self.root = Path(self.temp.name)
        self.origin, self.repo, self.tree = [self.root / name for name in ['origin.git', 'repo', 'landed-tree']]
        self.run_git('clone', '--bare', str(BUNDLE), str(self.origin))
        self.run_git('clone', str(self.origin), str(self.repo))
        self.run_git('-C', str(self.repo), 'checkout', 'main')
        self.main = self.run_git('-C', str(self.repo), 'rev-parse', 'main').stdout.strip()
        self.head = self.run_git('-C', str(self.repo), 'rev-parse', 'origin/reviewed').stdout.strip()
        self.run_git('-C', str(self.repo), 'worktree', 'add', '-b', 'landed', str(self.tree), self.head)
        self.run_git('-C', str(self.repo), 'push', 'origin', 'landed')
        self.db = self.root / 'threads.sqlite'
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute('CREATE TABLE orchestration_v2_projection_threads(thread_id TEXT,payload_json TEXT)')
            db.execute('CREATE TABLE orchestration_v2_projection_runs(thread_id TEXT,status TEXT)')
            db.execute('CREATE TABLE orchestration_v2_projection_runtime_requests(thread_id TEXT,status TEXT)')
        self.pr = {'merged': True, 'base': {'ref': 'main'}, 'head': {'ref': 'landed', 'sha': self.head, 'repo': {'full_name': health.REPOSITORY}}}
        self.old_cwd = Path.cwd()
        os.chdir(self.repo)
        self.git_calls = []
        def git(*args, **kwargs):
            self.git_calls.append(args)
            if args == ('remote', 'get-url', 'origin'):
                return subprocess.CompletedProcess(args, 0, 'https://github.com/' + health.REPOSITORY + '.git\n', '')
            return safety.git(*args, **kwargs)
        self.patches = [patch.object(health, 'git', git), patch.object(health, 'gh', self.gh), patch.object(health, 'consumers', lambda rows, symlinks=True: safety.consumers(rows, symlinks, str(self.root)))]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()
        os.chdir(self.old_cwd)
        self.temp.cleanup()

    def run_git(self, *args):
        result = subprocess.run(['git', *args], text=True, capture_output=True, timeout=10)
        if result.returncode:
            raise RuntimeError(result.stderr)
        return result

    def gh(self, endpoint, *options):
        if '/commits/main' in endpoint:
            return {'sha': self.main}
        if '?' in endpoint:
            return []
        return self.pr

    def cleanup(self, apply=True):
        return health.cleanup(42, self.db, apply)

    def assert_retained(self):
        self.assertTrue(self.tree.is_dir())
        self.assertEqual(self.run_git('ls-remote', str(self.origin), 'refs/heads/landed').stdout.split()[0], self.head)

    def test_clean_merged_unused_removes_tree_and_both_branches(self):
        result = self.cleanup()
        self.assertFalse(self.tree.exists())
        self.assertTrue(result['local_branch']['removed'])
        self.assertTrue(result['remote_branch']['removed'])
        self.assertEqual(result['worktrees'][0]['reasons'], [])
        self.assertIn(('worktree', 'remove', str(self.tree)), self.git_calls)
        self.assertIn(('branch', '-d', '--', 'landed'), self.git_calls)
        self.assertIn(('push', '--force-with-lease=refs/heads/landed:' + self.head, 'origin', ':refs/heads/landed'), self.git_calls)
        self.assertEqual(self.run_git('ls-remote', str(self.origin), 'refs/heads/landed').stdout, '')

    def test_audit_is_read_only(self):
        result = self.cleanup(False)
        self.assert_retained()
        self.assertFalse(result['worktrees'][0]['removed'])

    def test_unmerged_PR_refused(self):
        self.pr['merged'] = False
        with self.assertRaisesRegex(RuntimeError, 'not-a-merged'):
            self.cleanup()
        self.assert_retained()

    def test_dirty_tree_retains_both_branches(self):
        (self.tree / 'untracked').write_text('keep')
        result = self.cleanup()
        self.assertIn('dirty-or-unreadable', result['worktrees'][0]['reasons'])
        self.assert_retained()

    def test_head_outside_live_main_refused(self):
        self.run_git('-C', str(self.tree), 'checkout', '-B', 'landed', self.main)
        self.run_git('push', 'origin', 'landed')
        self.head, self.main = self.main, self.head
        self.pr['head']['sha'] = self.head
        self.assertTrue(self.cleanup()['worktrees'][0]['reasons'])
        self.assert_retained()

    def test_active_and_queued_threads_refused(self):
        for status in ['running', 'waiting', 'queued', 'preparing', 'starting']:
            with self.subTest(status=status):
                with closing(sqlite3.connect(self.db)) as db, db:
                    db.execute('DELETE FROM orchestration_v2_projection_runs')
                    db.execute('INSERT OR REPLACE INTO orchestration_v2_projection_threads VALUES(?,?)', ('busy', json.dumps({'id': 'busy', 'branch': 'landed', 'worktreePath': str(self.tree)})))
                    db.execute('INSERT INTO orchestration_v2_projection_runs VALUES(?,?)', ('busy', status))
                self.assertIn('active-thread:busy', self.cleanup()['worktrees'][0]['reasons'])
                self.assert_retained()

    def test_missing_safety_database_refused(self):
        self.db.unlink()
        with self.assertRaisesRegex(RuntimeError, 'safety database unavailable'):
            self.cleanup()
        self.assert_retained()

    def test_external_symlink_refused(self):
        (self.root / 'consumer').symlink_to(self.tree, target_is_directory=True)
        self.assertIn('process-or-symlink-consumer', self.cleanup()['worktrees'][0]['reasons'])
        self.assert_retained()

    def test_live_process_cwd_refused(self):
        child = subprocess.Popen(['python3', '-c', 'import time;time.sleep(30)'], cwd=self.tree)
        try:
            self.assertIn('process-or-symlink-consumer', self.cleanup()['worktrees'][0]['reasons'])
            self.assert_retained()
        finally:
            child.kill()
            child.wait()

    def test_new_remote_commit_retained(self):
        self.run_git('push', 'origin', 'main:landed')
        result = self.cleanup()
        self.assertFalse(result['remote_branch']['removed'])
        self.assertIn('remote-branch-advanced', result['remote_branch']['reasons'])
        self.assertEqual(self.run_git('ls-remote', str(self.origin), 'refs/heads/landed').stdout.split()[0], self.main)

    def test_protected_pin_and_owner_are_retained(self):
        for row in [dict(path=str(self.tree / 'owner-editor'), head=self.head, branch='landed'), dict(path=str(self.tree), head='b343343' + '0' * 33, branch='landed')]:
            self.assertTrue(safety.protections(row, []))

    def test_pending_thread_request_refused(self):
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute('INSERT INTO orchestration_v2_projection_threads VALUES(?,?)', ('queued', json.dumps({'id': 'queued', 'worktreePath': str(self.tree)})))
            db.execute('INSERT INTO orchestration_v2_projection_runtime_requests VALUES(?,?)', ('queued', 'pending'))
        self.assertIn('active-thread:queued', self.cleanup()['worktrees'][0]['reasons'])
        self.assert_retained()

    def test_head_changed_during_audit_refused(self):
        original = health.consumers
        def consumers(rows, symlinks=True):
            result = original(rows, symlinks)
            if not symlinks:
                self.run_git('-C', str(self.tree), 'checkout', '--detach', self.main)
            return result
        with patch.object(health, 'consumers', consumers):
            result = self.cleanup()
        self.assertIn('worktree-head-changed', result['worktrees'][0]['reasons'])
        self.assert_retained()

    def test_remote_lease_refuses_concurrent_advance(self):
        original = health.git
        def git(*args, **kwargs):
            if args[0] == 'push':
                self.run_git('push', 'origin', 'main:landed')
            return original(*args, **kwargs)
        with patch.object(health, 'git', git):
            result = self.cleanup()
        self.assertFalse(result['remote_branch']['removed'])
        self.assertTrue(any(reason.startswith('remote-delete-refused:') for reason in result['remote_branch']['reasons']))
        self.assertEqual(self.run_git('ls-remote', str(self.origin), 'refs/heads/landed').stdout.split()[0], self.main)

    def test_open_PR_preserves_remote(self):
        original = self.gh
        with patch.object(health, 'gh', lambda endpoint, *options: [{'number': 43}] if '?' in endpoint else original(endpoint, *options)):
            result = self.cleanup()
        self.assertIn('open-PR-still-uses-branch', result['remote_branch']['reasons'])
        self.assertFalse(result['remote_branch']['removed'])
        self.assert_retained()

    def test_disappeared_worktree_is_a_refusal(self):
        missing = safety.git('status', cwd=self.root / 'missing')
        self.assertNotEqual(missing.returncode, 0)
        self.assertTrue(missing.stderr)

    def test_missing_remote_branch_is_idempotent(self):
        self.cleanup()
        result = self.cleanup()
        self.assertEqual(result['worktrees'], [])
        self.assertIsNone(result['local_branch'])
        self.assertIsNone(result['remote_branch'])

class RunTests(unittest.TestCase):
    def setUp(self):
        self.sha = 'a' * 40
        self.runs = [self.workflow(1, 'CI', 'push'), self.workflow(2, 'Deploy', 'workflow_run')]

    def workflow(self, number, name, event):
        return {'id': number, 'name': name, 'event': event, 'head_sha': self.sha, 'head_branch': 'main', 'run_number': number, 'run_attempt': 1, 'status': 'completed', 'conclusion': 'success', 'html_url': 'https://example.invalid/' + str(number)}

    def gh(self, endpoint, *options):
        if '/jobs?' in endpoint:
            return {'jobs': []}
        return {'workflow_runs': self.runs}

    def test_exact_sha_success(self):
        with patch.object(health, 'gh', self.gh):
            self.assertEqual(health.run_receipt(self.sha)['result'], 'success')

    def test_wrong_sha_wrong_branch_and_PR_success_do_not_count(self):
        for field, wrong in [('head_sha', 'b' * 40), ('head_branch', 'topic'), ('event', 'pull_request')]:
            with self.subTest(field=field):
                original = self.runs[0][field]
                self.runs[0][field] = wrong
                with patch.object(health, 'gh', self.gh):
                    self.assertEqual(health.run_receipt(self.sha)['result'], 'pending')
                self.runs[0][field] = original

    def test_failure_reports_real_failed_step(self):
        self.runs[1]['conclusion'] = 'failure'
        def gh(endpoint, *options):
            if '/2/jobs?' in endpoint:
                return {'jobs': [{'name': 'production', 'conclusion': 'failure', 'steps': [{'name': 'Verify live', 'conclusion': 'failure'}]}]}
            return self.gh(endpoint, *options)
        with patch.object(health, 'gh', gh):
            receipt = health.run_receipt(self.sha)
            self.assertEqual(receipt['result'], 'failure')
            self.assertEqual(receipt['runs'][1]['failed_steps'][0]['steps'], ['Verify live'])

    def test_wait_observes_job_result_instead_of_wait_command_exit(self):
        pending = {'result': 'pending'}
        success = {'result': 'success'}
        emitted, slept = [], []
        with patch.object(health, 'run_receipt', side_effect=[pending, success]):
            self.assertEqual(health.await_runs(self.sha, 10, 1, emit=emitted.append, clock=lambda: 0, sleep=slept.append), 0)
        self.assertEqual(slept, [1])
        self.assertEqual(json.loads(emitted[0])['result'], 'success')

    def test_pending_and_failed_have_distinct_nonzero_codes(self):
        for value, expected in [('pending', 124), ('failure', 1)]:
            with self.subTest(value=value), patch.object(health, 'run_receipt', return_value={'result': value}):
                output = []
                self.assertEqual(health.await_runs(self.sha, 0, 1, emit=output.append, clock=lambda: 0), expected)
                self.assertEqual(json.loads(output[0])['result'], 'timeout' if value == 'pending' else 'failure')

if __name__ == '__main__':
    unittest.main()
