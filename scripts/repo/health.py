import argparse
import json
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote

from worktree_safety import active_bindings, consumers, git, inventory, protections, visibility_blocks

REPOSITORY = 'Rickvu309/AirDesign'

def gh(endpoint, *options):
    result = subprocess.run(['gh', 'api', endpoint, *options], text=True, capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout) if result.stdout.strip() else None

def live_main():
    sha = gh(f'repos/{REPOSITORY}/commits/main')['sha']
    if git('cat-file', '-e', sha + '^{commit}').returncode:
        result = git('fetch', 'origin', sha)
        if result.returncode:
            raise RuntimeError('live-main-object-unavailable:' + result.stderr)
    return sha

def branch_reason(branch, head, main, bindings):
    row = {'path': '', 'branch': branch, 'head': head}
    reasons = protections(row, bindings)
    if git('merge-base', '--is-ancestor', head, main).returncode:
        reasons.append('unmerged-or-unavailable-head')
    return reasons

def cleanup(pr_number, database, apply=False):
    origin = git('remote', 'get-url', 'origin')
    if origin.returncode or origin.stdout.strip().removesuffix('.git') not in {'https://github.com/' + REPOSITORY, 'git@github.com:' + REPOSITORY, 'ssh://git@github.com/' + REPOSITORY}:
        raise RuntimeError('unexpected-origin-repository')
    pr = gh(f'repos/{REPOSITORY}/pulls/{pr_number}')
    if not pr.get('merged') or pr['base']['ref'] != 'main' or not pr['head'].get('repo') or pr['head']['repo']['full_name'] != REPOSITORY:
        raise RuntimeError('not-a-merged-same-repository-main-PR')
    branch, head = pr['head']['ref'], pr['head']['sha']
    main = live_main()
    bindings = active_bindings(database)
    open_prs = gh(f'repos/{REPOSITORY}/pulls?state=open&head=Rickvu309:{quote(branch, safe="")}')
    rows, _ = inventory()
    targets = [row for row in rows if row['branch'] == 'refs/heads/' + branch or row['head'] == head]
    hits, stats = consumers(targets)
    result = {'pr': pr_number, 'main': main, 'head': head, 'apply': apply, 'worktrees': [], 'local_branch': None, 'remote_branch': None, 'visibility': stats}
    refused = False
    for row in targets:
        reasons = protections(row, bindings)
        if open_prs:
            reasons.append('open-PR-still-uses-branch')
        status = git('status', '--porcelain=v1', '--untracked-files=all', cwd=row['path'])
        if status.returncode or status.stdout:
            reasons.append('dirty-or-unreadable')
        if git('merge-base', '--is-ancestor', row['head'], main).returncode:
            reasons.append('unmerged-or-unavailable-head')
        if hits[row['path']]:
            reasons.append('process-or-symlink-consumer')
        if visibility_blocks(stats):
            reasons.append('unclassified-process-visibility')
        if apply and not reasons:
            current_hits, current_stats = consumers([row], symlinks=False)
            reasons.extend(protections(row, active_bindings(database)))
            if current_hits[row['path']] or visibility_blocks(current_stats):
                reasons.append('process-consumer-at-removal')
            current_head = git('rev-parse', 'HEAD', cwd=row['path'])
            if current_head.returncode or current_head.stdout.strip() != row['head']:
                reasons.append('worktree-head-changed')
            if not reasons:
                removed = git('worktree', 'remove', row['path'])
                if removed.returncode:
                    reasons.append('git-remove-refused:' + removed.stderr.strip())
        refused = refused or bool(reasons)
        result['worktrees'].append({'path': row['path'], 'head': row['head'], 'reasons': reasons, 'removed': apply and not reasons, 'consumers': hits[row['path']]})
    rows_after, _ = inventory()
    branch_result = git('rev-parse', '--verify', '--quiet', 'refs/heads/' + branch)
    reasons = branch_reason(branch, head, main, active_bindings(database))
    if open_prs:
        reasons.append('open-PR-still-uses-branch')
    if refused or any(row['branch'] == 'refs/heads/' + branch for row in rows_after):
        reasons.append('worktree-retained')
    if branch_result.returncode == 0:
        local_head = branch_result.stdout.strip()
        if local_head != head:
            reasons.append('local-branch-differs-from-PR')
        if apply and not reasons:
            removed = git('branch', '-d', '--', branch)
            if removed.returncode:
                reasons.append('git-branch-delete-refused:' + removed.stderr.strip())
        result['local_branch'] = {'name': branch, 'removed': apply and not reasons, 'reasons': list(reasons)}
    elif branch_result.returncode != 1:
        raise RuntimeError('local-ref-unreadable:' + branch_result.stderr)
    remote = git('ls-remote', '--heads', 'origin', 'refs/heads/' + branch)
    if remote.returncode:
        raise RuntimeError('remote-ref-unreadable:' + remote.stderr)
    if remote.stdout.strip():
        remote_head = remote.stdout.split()[0]
        if remote_head != head:
            reasons.append('remote-branch-advanced')
        open_prs = gh(f'repos/{REPOSITORY}/pulls?state=open&head=Rickvu309:{quote(branch, safe="")}')
        if open_prs:
            reasons.append('open-PR-still-uses-branch')
        reasons.extend(branch_reason(branch, head, main, active_bindings(database)))
        if apply and not reasons:
            deleted = git('push', '--force-with-lease=refs/heads/' + branch + ':' + head, 'origin', ':refs/heads/' + branch)
            if deleted.returncode:
                reasons.append('remote-delete-refused:' + deleted.stderr.strip())
        result['remote_branch'] = {'name': branch, 'removed': apply and not reasons, 'reasons': list(dict.fromkeys(reasons))}
    return result

def run_receipt(sha):
    runs = gh(f'repos/{REPOSITORY}/actions/runs?head_sha={sha}&per_page=100')['workflow_runs']
    selected = []
    for name, event in [('CI', 'push'), ('Deploy', 'workflow_run')]:
        matches = [run for run in runs if run['name'] == name and run['event'] == event and run['head_sha'] == sha and run['head_branch'] == 'main']
        if not matches:
            selected.append({'name': name, 'status': 'not-found', 'conclusion': None, 'failed_steps': []})
            continue
        run = max(matches, key=lambda value: (value['run_number'], value.get('run_attempt', 1)))
        failed = []
        page = 1
        while True:
            jobs = gh(f'repos/{REPOSITORY}/actions/runs/{run["id"]}/jobs?filter=latest&per_page=100&page={page}')['jobs']
            for job in jobs:
                if job['conclusion'] not in {None, 'success', 'skipped'}:
                    steps = [step['name'] for step in job.get('steps', []) if step['conclusion'] not in {None, 'success', 'skipped'}]
                    failed.append({'job': job['name'], 'conclusion': job['conclusion'], 'steps': steps})
            if len(jobs) < 100:
                break
            page += 1
        selected.append({'name': name, 'id': run['id'], 'head_sha': run['head_sha'], 'status': run['status'], 'conclusion': run['conclusion'], 'url': run['html_url'], 'failed_steps': failed})
    terminal_failure = any(run['status'] == 'completed' and run['conclusion'] != 'success' for run in selected)
    success = all(run['status'] == 'completed' and run['conclusion'] == 'success' for run in selected)
    return {'sha': sha, 'runs': selected, 'result': 'success' if success else 'failure' if terminal_failure else 'pending'}

def await_runs(sha, timeout, interval, emit=print, clock=time.monotonic, sleep=time.sleep):
    deadline = clock() + timeout
    while True:
        receipt = run_receipt(sha)
        if receipt['result'] != 'pending' or clock() >= deadline:
            if receipt['result'] == 'pending':
                receipt['result'] = 'timeout'
            emit(json.dumps(receipt))
            return 0 if receipt['result'] == 'success' else 124 if receipt['result'] == 'timeout' else 1
        sleep(min(interval, max(0, deadline - clock())))

def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest='command', required=True)
    after = commands.add_parser('after-merge')
    after.add_argument('pr', type=int)
    after.add_argument('--apply', action='store_true')
    after.add_argument('--t3-db', type=Path, default=Path.home() / '.t3/userdata/statev2.sqlite')
    wait = commands.add_parser('runs')
    wait.add_argument('sha')
    wait.add_argument('--timeout', type=int, default=3600)
    wait.add_argument('--interval', type=int, default=20)
    args = parser.parse_args()
    try:
        if args.command == 'after-merge':
            result = cleanup(args.pr, args.t3_db, args.apply)
            print(json.dumps(result))
            return 0 if not any(row['reasons'] for row in result['worktrees']) and not any(result[key] and result[key]['reasons'] for key in ['local_branch', 'remote_branch']) else 1
        if not re.fullmatch('[0-9a-f]{40}', args.sha) or args.timeout < 0 or args.interval < 1:
            raise RuntimeError('expected-full-sha-and-nonnegative-timeout-positive-interval')
        return await_runs(args.sha, args.timeout, args.interval)
    except (OSError, RuntimeError, ValueError, sqlite3.Error, subprocess.TimeoutExpired) as error:
        print(json.dumps({'result': 'refused', 'error': str(error)}))
        return 1

if __name__ == '__main__':
    sys.exit(main())
